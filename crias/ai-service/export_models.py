"""
Export trained CRIAS models to a single JSON file so the inference logic can be
ported to pure JavaScript (Node backend) with NO Python dependency.

Strategy:
  1. Try to load the committed .pkl models (most faithful to what was shipped).
  2. If they fail to load (sklearn version drift), deterministically regenerate
     them with the EXACT training code from services/predictor.py (seed 42).
  3. Export scaler params, logistic-regression coefficients, and every tree of
     the Random Forest and Gradient Boosting ensembles.
  4. VALIDATE that a from-scratch reconstruction of predict_proba (the same math
     that will run in JS) matches sklearn to < 1e-9 across random inputs.
"""
import json
import os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

MODEL_PATH = "./models"
OUT_PATH = "../backend/src/ml/models.json"
FEATURES = ["current_ratio", "debt_ratio", "liquidity_ratio"]


def make_training_data():
    """Reproduce the synthetic dataset from predictor.py (seed 42)."""
    np.random.seed(42)
    n = 1000
    good = np.column_stack([
        np.random.uniform(1.5, 3.0, n // 2),
        np.random.uniform(0.2, 0.5, n // 2),
        np.random.uniform(0.3, 0.8, n // 2),
    ])
    risky = np.column_stack([
        np.random.uniform(0.5, 1.5, n // 2),
        np.random.uniform(0.5, 0.9, n // 2),
        np.random.uniform(0.05, 0.3, n // 2),
    ])
    X = np.vstack([good, risky])
    y = np.array([0] * (n // 2) + [1] * (n // 2))
    idx = np.random.permutation(n)
    return X[idx], y[idx]


def regenerate():
    """Retrain exactly as services/predictor.py does."""
    X, y = make_training_data()
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)

    lr = LogisticRegression(class_weight="balanced", random_state=42).fit(Xs, y)
    rf = RandomForestClassifier(n_estimators=100, max_depth=10,
                                class_weight="balanced", random_state=42).fit(Xs, y)
    gb = GradientBoostingClassifier(n_estimators=200, learning_rate=0.05,
                                    max_depth=6, random_state=42).fit(Xs, y)
    return scaler, {"logistic_regression": lr, "random_forest": rf, "xgboost": gb}


def try_load():
    import joblib
    scaler = joblib.load(f"{MODEL_PATH}/scaler.pkl")
    models = {
        "logistic_regression": joblib.load(f"{MODEL_PATH}/logistic_regression.pkl"),
        "random_forest": joblib.load(f"{MODEL_PATH}/random_forest.pkl"),
        "xgboost": joblib.load(f"{MODEL_PATH}/xgboost.pkl"),
    }
    return scaler, models


def export_tree(tree):
    """Serialize a sklearn Tree object to plain arrays."""
    t = tree.tree_
    # value shape: (n_nodes, n_outputs, n_classes_or_1)
    values = t.value.reshape(t.value.shape[0], -1).tolist()
    return {
        "children_left": t.children_left.tolist(),
        "children_right": t.children_right.tolist(),
        "feature": t.feature.tolist(),
        "threshold": t.threshold.tolist(),
        "value": values,
    }


def main():
    source = "regenerated"
    try:
        scaler, models = try_load()
        source = "loaded_pkl"
    except Exception as e:  # noqa
        print(f"  pkl load failed ({e}); regenerating deterministically")
        scaler, models = regenerate()

    lr = models["logistic_regression"]
    rf = models["random_forest"]
    gb = models["xgboost"]

    # --- Gradient boosting: recover constant init raw score ---
    probe = np.array([[0.0, 0.0, 0.0]])
    tree_sum = sum(est[0].predict(probe)[0] for est in gb.estimators_)
    gb_init_raw = float(gb.decision_function(probe)[0] - gb.learning_rate * tree_sum)

    export = {
        "source": source,
        "features": FEATURES,
        "scaler": {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()},
        "logistic_regression": {
            "coef": lr.coef_[0].tolist(),
            "intercept": float(lr.intercept_[0]),
        },
        "random_forest": {
            "trees": [export_tree(t) for t in rf.estimators_],
        },
        "xgboost": {
            "init_raw": gb_init_raw,
            "learning_rate": float(gb.learning_rate),
            "trees": [export_tree(est[0]) for est in gb.estimators_],
        },
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(export, f)

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Exported ({source}) -> {OUT_PATH}  ({size_kb:.0f} KB)")

    # ------------------------------------------------------------------
    # VALIDATE: reconstruct predict_proba the same way JS will, compare.
    # ------------------------------------------------------------------
    def walk(tree, x):
        node = 0
        cl, cr, feat, thr = (tree["children_left"], tree["children_right"],
                             tree["feature"], tree["threshold"])
        while cl[node] != -1:
            node = cl[node] if x[feat[node]] <= thr[node] else cr[node]
        return tree["value"][node]

    def sigmoid(z):
        return 1.0 / (1.0 + np.exp(-z))

    def js_lr(xs):
        z = np.dot(xs, export["logistic_regression"]["coef"]) + export["logistic_regression"]["intercept"]
        return sigmoid(z)

    def js_rf(xs):
        acc = 0.0
        for tr in export["random_forest"]["trees"]:
            v = walk(tr, xs)
            acc += v[1] / (v[0] + v[1])  # class-1 proportion
        return acc / len(export["random_forest"]["trees"])

    def js_gb(xs):
        raw = export["xgboost"]["init_raw"]
        lr_ = export["xgboost"]["learning_rate"]
        for tr in export["xgboost"]["trees"]:
            raw += lr_ * walk(tr, xs)[0]
        return sigmoid(raw)

    rng = np.random.RandomState(7)
    Xtest = rng.uniform([0.3, 0.1, 0.02], [3.5, 1.0, 1.0], size=(300, 3))
    Xts = scaler.transform(Xtest)

    errs = {"logistic_regression": 0.0, "random_forest": 0.0, "xgboost": 0.0}
    for i in range(len(Xtest)):
        xs = Xts[i]
        errs["logistic_regression"] = max(errs["logistic_regression"],
            abs(js_lr(xs) - lr.predict_proba([xs])[0][1]))
        errs["random_forest"] = max(errs["random_forest"],
            abs(js_rf(xs) - rf.predict_proba([xs])[0][1]))
        errs["xgboost"] = max(errs["xgboost"],
            abs(js_gb(xs) - gb.predict_proba([xs])[0][1]))

    print("Max abs error vs sklearn predict_proba (over 300 samples):")
    for k, v in errs.items():
        flag = "OK" if v < 1e-9 else "FAIL"
        print(f"  {k:20s} {v:.2e}  [{flag}]")

    assert all(v < 1e-9 for v in errs.values()), "Reconstruction mismatch!"
    print("VALIDATION PASSED - JS port will match sklearn exactly.")


if __name__ == "__main__":
    main()
