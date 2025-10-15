from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Globale Variable für den MongoDB Client, um die Wiederverwendung in Serverless-Umgebungen zu ermöglichen
mongo_client = None

def get_db():
    """Verbindung zur MongoDB herstellen und wiederverwenden"""
    global mongo_client
    
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        print("ERROR: MONGODB_URI environment variable not set.")
        return None
    
    if mongo_client is None:
        try:
            mongo_client = MongoClient(mongodb_uri)
            mongo_client.admin.command("ping") 
            print("MongoDB Client initialized successfully.")
        except Exception as e:
            print(f"ERROR: Failed to initialize MongoDB client: {e}")
            mongo_client = None
            return None
    
    if mongo_client:
        return mongo_client["twitch_bet_calculator"]
    return None

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """Globale Statistiken und Performance-Modell abrufen"""
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not configured in get_statistics.")
            return jsonify({"error": "Database not configured"}), 500
        
        total_tournaments = db.tournaments.count_documents({})
        tournaments_won = db.tournaments.count_documents({"is_eliminated": False, "current_round": {"$gt": 0}})
        tournaments_lost = db.tournaments.count_documents({"is_eliminated": True})
        
        # Durchschnittliche erreichte Runde
        pipeline_avg_round = [
            {"$group": {
                "_id": None,
                "avg_round": {"$avg": "$current_round"}
            }}
        ]
        avg_result = list(db.tournaments.aggregate(pipeline_avg_round))
        avg_round = avg_result[0]["avg_round"] if avg_result and "avg_round" in avg_result[0] else 0

        # Performance-Modell: Durchschnittliche erreichte Runde pro Skill-Level
        pipeline_performance = [
            {"$group": {
                "_id": "$skill_level",
                "avg_round_reached": {"$avg": "$current_round"}
            }}
        ]
        performance_results = list(db.tournaments.aggregate(pipeline_performance))
        performance_model = {item["_id"]: item["avg_round_reached"] for item in performance_results}
        
        stats = {
            "total_tournaments": total_tournaments,
            "tournaments_won": tournaments_won,
            "tournaments_lost": tournaments_lost,
            "average_round_reached": round(avg_round, 2),
            "performance_model": performance_model
        }
        
        return jsonify(stats), 200
    except Exception as e:
        print(f"ERROR in get_statistics: {e}")
        return jsonify({"error": "Fehler beim Abrufen der Statistiken: " + str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health Check Endpoint"""
    return jsonify({"status": "ok", "message": "API is running"}), 200

# For Vercel Serverless Functions, we typically expose the \'app\' directly
# Vercel\'s Python runtime will automatically detect the \'app\' variable as the WSGI application.

