import pandas as pd

df = pd.read_csv("../dataset/chess_games.csv")

print(df.head())
print()
print("Columns:")
print(df.columns)