import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import joblib

# Load dataset
df = pd.read_csv("../dataset/chess_games.csv")

# Keep only useful columns
df = df[["moves", "opening_name"]]

# Remove empty rows
df = df.dropna()

# Use only first few moves for prediction
df["moves"] = df["moves"].apply(
    lambda x: " ".join(str(x).split()[:6])
)

# Input and output
X = df["moves"]
y = df["opening_name"]

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ML pipeline
model = Pipeline([
    ("vectorizer", CountVectorizer()),
    ("classifier", MultinomialNB())
])

# Train
model.fit(X_train, y_train)

# Accuracy
accuracy = model.score(X_test, y_test)
print("Accuracy:", accuracy)

# Save model
joblib.dump(model, "../models/opening_model.pkl")

print("Model saved successfully.")