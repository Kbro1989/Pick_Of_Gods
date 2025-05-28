import time
import numpy as np
import pyttsx3
import requests
import json
import os
import cv2

INVENTORY_FULL_THRESHOLD = 28
CHAT_MONITOR_KEYWORDS = ["logout", "emergency"]
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_API_URL = "https://api.github.com/repos/kbro1989/Pick_Of_Gods/contents"
ALT1_ENABLED = True
UI_LAYOUT = { "clickers": {"x": 400, "y": 600}, "id": {"x": 1000, "y": 300}, "r": {"x": 800, "y": 400} }
BASE_URL = "http://localhost:8080"

class RS3Bot:
    def __init__(self):
        self.running = True
        self.engine = pyttsx3.init()
        self.engine.setProperty("rate", 150)
        self.actions = []
        self.base_url = BASE_URL

    def speak(self, text):
        print(f"Speaking: {text}")
        self.engine.say(text)
        self.engine.runAndWait()

    def check_inventory(self):
        try:
            screen = cv2.imread("screenshot.png")  # Placeholder for Alt1 capture
            if screen is None:
                inventory_count = np.random.randint(0, 30)
            else:
                contours, _ = cv2.findContours(cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                inventory_count = len(contours)
            self.speak(f"Inventory count: {inventory_count}")
            return inventory_count >= INVENTORY_FULL_THRESHOLD
        except:
            self.speak("Error reading inventory")
            return False

    def monitor_chat(self):
        chat_message = "logout" if np.random.random() > 0.8 else "normal message"  # Placeholder for Alt1
        self.speak(f"Chat message detected: {chat_message}")
        self.actions.append({"type": "chat", "message": chat_message, "timestamp": time.time()})
        return any(keyword in chat_message.lower() for keyword in CHAT_MONITOR_KEYWORDS)

    def monitor_afk(self):
        self.speak("Checking AFK status via Alt1 AFKwarden")
        try:
            afk_alert = np.random.choice([True, False])  # Mock alert
            if afk_alert:
                self.speak("AFK alert detected, prompting action")
                self.request_action("Click to resume", UI_LAYOUT["clickers"])
            return afk_alert
        except:
            self.speak("Failed to monitor AFK")
            return False

    def solve_clue(self):
        self.speak("Using Alt1 Clue Solver overlay")
        try:
            clue_data = {"solution": "Check inventory slot 1"}  # Mock response
            self.actions.append({"type": "clue", "data": clue_data, "timestamp": time.time()})
            self.request_action(f"Solve clue: {clue_data[\"solution\"]}", UI_LAYOUT["id"])
        except:
            self.speak("Failed to solve clue")

    def track_abilities(self):
        self.speak("Using Alt1 Ability Tracker")
        try:
            ability_data = {"ability": "Next ability: Surge"}  # Mock response
            self.actions.append({"type": "ability", "data": ability_data, "timestamp": time.time()})
            self.request_action(f"Use ability: {ability_data[\"ability\"]}", UI_LAYOUT["clickers"])
        except:
            self.speak("Failed to track abilities")

    def craft_time_rune(self):
        self.speak("Crafting Time Rune")
        try:
            action = {"action": "Craft Time Essence", "slot_index": 0}
            self.request_action(action["action"], UI_LAYOUT["r"])
            self.actions.append({"type": "crafting", "action": action, "timestamp": time.time()})
        except:
            self.speak("Failed to craft Time Rune")

    def handle_telos_phase(self, phase):
        self.speak(f"Handling Telos phase {phase}")
        try:
            actions = {
                1: {"action": "Activate Death Skulls", "bar": "clickers", "slot_index": 0},
                2: {"action": "Clear virus", "bar": "id", "slot_index": 1},
                3: {"action": "Dodge anima bomb", "bar": "clickers", "slot_index": 2}
            }
            action_data = actions.get(phase, {"action": "Activate ability", "bar": "clickers", "slot_index": 0})
            self.request_action(action_data["action"], UI_LAYOUT[action_data["bar"]])
            self.actions.append({"type": "telos_phase", "phase": phase, "action": action_data, "timestamp": time.time()})
        except:
            self.speak("Failed to handle Telos phase")

    def read_game_screen(self):
        if not ALT1_ENABLED:
            return UI_LAYOUT
        try:
            response = requests.get(f"{self.base_url}/next-action?task=Telos")
            if response.status_code == 200:
                action = response.json()
                self.actions.append({"type": "action", "data": action, "timestamp": time.time()})
                self.speak(f"Overlay prompted: {action.get(\"action\", \"unknown\")}")
                return UI_LAYOUT
        except:
            self.speak("Error reading game screen")
            return UI_LAYOUT

    def request_action(self, action, coords):
        try:
            requests.post(f"{self.base_url}/next-action", json={"action": action, "coords": coords})
            self.speak(f"Prompted {action} at ({coords[\"x\"]}, {coords[\"y\"]})")
            self.actions.append({"type": "prompt", "action": action, "coords": coords, "timestamp": time.time()})
        except:
            self.speak("Failed to prompt action")

    def get_next_action(self, task):
        try:
            response = requests.get(f"{self.base_url}/next-action?task={task}")
            if response.status_code == 200:
                return response.json()
        except:
            self.speak("Failed to fetch next action")
            return None

    def save_actions_to_github(self):
        if not GITHUB_TOKEN:
            print("No GitHub token set")
            return
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        content = json.dumps(self.actions)
        data = {
            "message": "Update actions",
            "content": base64.b64encode(content.encode()).decode(),
            "branch": "main"
        }
        try:
            response = requests.put(
                f"{GITHUB_API_URL}/actions.json",
                headers=headers,
                json=data
            )
            if response.status_code in [200, 201]:
                self.speak("Actions saved to GitHub")
            else:
                print(f"GitHub error: {response.text}")
        except:
            print("Failed to save to GitHub")

    def learn_from_actions(self):
        if len(self.actions) > 1:
            recent = self.actions[-2:]
            if recent[0]["type"] == "chat" and recent[1]["type"] == "prompt":
                self.speak(f"Learned: Chat {recent[0].get(\"message\", \"unknown\")} precedes {recent[1].get(\"action\", \"unknown\")}")

    def perform_action(self, action_type):
        if action_type == "drop_inventory":
            self.speak("Prompting drop inventory")
            self.actions.append({"type": "drop_inventory", "timestamp": time.time()})
            self.request_action("Drop items", UI_LAYOUT["id"])
        elif action_type == "logout":
            self.speak("Prompting logout")
            self.running = False

    def run(self):
        self.running = True
        self.speak("RuneScape 3 bot started. Using Alt1 overlays.")
        task = "Telos"  # Switch to "TimeRune" for crafting
        while self.running:
            if self.check_inventory():
                self.perform_action("drop_inventory")
            if self.monitor_chat():
                self.perform_action("logout")
                break
            if self.monitor_afk():
                continue
            ui_layout = self.read_game_screen()
            self.solve_clue()
            self.track_abilities()
            if task == "TimeRune":
                self.craft_time_rune()
            action_data = self.get_next_action(task)
            if task == "Telos":
                phase = np.random.randint(1, 4)
                self.handle_telos_phase(phase)
            if action_data:
                action = action_data.get("action")
                bar = action_data.get("bar", "clickers")
                slot_index = action_data.get("slot_index", 0)
                coords = ui_layout.get(bar, ui_layout["clickers"])
                x = coords["x"] + (slot_index * 50)
                y = coords["y"]
                self.request_action(action, {"x": x, "y": y})
            self.learn_from_actions()
            self.save_actions_to_github()
            time.sleep(1)
        self.speak("RuneScape 3 bot stopped.")

if __name__ == "__main__":
    bot = RS3Bot()
    bot.run()
