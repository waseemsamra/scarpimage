#!/bin/bash
source .venv/bin/activate

# Check if requirements are installed
pip freeze > installed.txt
if ! cmp -s requirements.txt installed.txt; then
  echo "Installing dependencies..."
  pip install -r requirements.txt
fi
rm installed.txt

# Run the Flask app
export FLASK_APP=run.py
flask run --host=0.0.0.0 --port=8088
