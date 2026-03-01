from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from dotenv import load_dotenv
import os

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Initialiser le client Mistral avec votre clé API
api_key = os.environ["MISTRAL_API_KEY"]
client = MistralClient(api_key=api_key)

# Envoyer une requête
messages = [ChatMessage(role="user", content="Bonjour, comment ça va ?")]

chat_response = client.chat(model="mistral-tiny", messages=messages)

# Afficher la réponse
print(chat_response.choices[0].message.content)
