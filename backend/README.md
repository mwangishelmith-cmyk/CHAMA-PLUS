## Activate the environment in PowerShell
- cd "c:\Users\shelmith\Documents\Final year project\chamaplus-project\backend"
- .\venv\Scripts\Activate.ps1

## Ran the backend

 cd "/mnt/c/Users/shelmith/Documents/Final year project/chamaplus-project/backend"
 source venv/bin/activate
 pip install -r requirements.txt
 python app.py

- If you prefer Flask’s runner instead, use:

 export FLASK_APP=app.py
 flask run

## DB Migrations

### Create migration repository
flask db init
- Only once	
- When you first enable Flask-Migrate in a new project. It creates the migrations/ folder.

### Generate initial migration
flask db migrate -m "Initial database schema"
- flask db migrate -m "message"	Every time your models change.After adding, removing, or modifying models or columns.

### Apply migration
flask db upgrade
- flask db upgrade	After every successful migration	Applies the generated migration to your PostgreSQL database.