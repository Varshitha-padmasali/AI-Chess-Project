import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
import joblib

data = pd.read_csv("../dataset/move_data.csv")

X = data[["before_eval", "after_eval", "diff"]]
y = data["label"]

model = DecisionTreeClassifier()
model.fit(X, y)

joblib.dump(model, "../models/move_classifier.pkl")

print("Model trained and saved.")