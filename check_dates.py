import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from src.data.db import fetch_forecast_predictions

res = fetch_forecast_predictions('P002', 'S06')
print(f"Total rows: {len(res)}")
if res:
    print("First row:", res[0])
    print("Last row:", res[-1])
