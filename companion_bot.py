import time
import numpy as np

INVENTORY_FULL_THRESHOLD = 28
CHAT_MONITOR_KEYWORDS = ['logout', 'emergency']

class CompanionBot:
    def __init__(self):
        self.running = False

    def check_inventory(self):
        inventory_count = np.random.randint(0, 30)  # Replace with alt1 API call
        print(f'Inventory count: {inventory_count}')
        return inventory_count >= INVENTORY_FULL_THRESHOLD

    def monitor_chat(self):
        chat_message = 'logout' if np.random.random() > 0.8 else 'normal message'  # Replace with alt1 API call
        print(f'Chat message detected: {chat_message}')
        return any(keyword in chat_message.lower() for keyword in CHAT_MONITOR_KEYWORDS)

    def perform_action(self, action_type):
        if action_type == 'drop_inventory':
            print('Logging: Would drop inventory here')
        elif action_type == 'logout':
            print('Logging: Would logout here')

    def run(self):
        self.running = True
        print('Companion bot started. Running until stopped.')
        while self.running:
            if self.check_inventory():
                self.perform_action('drop_inventory')
                time.sleep(2)
            if self.monitor_chat():
                self.perform_action('logout')
                self.running = False
                break
            time.sleep(1)

if __name__ == '__main__':
    bot = CompanionBot()
    bot.run()