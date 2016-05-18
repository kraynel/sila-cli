# Protocole utilisé par l'application

## Requêtes SOAP

L'ensemble des requêtes de fait en HTTP sur le même point de sortie. Le protocol SOAP est utilisé, sans extension security ou autre.

Deux types de requêtes sont utilisées : [la première](../soap/loginRequest.xml) est spécifique à l'échange de clé RSA, [la seconde](../soap/genericRequest.xml) est plus générique.

### Échange de clé RSA

La première étape pour se connecter au service est d'échanger une clé publique RSA avec le server. Celui-ci nous répondra avec une clé publique RSA unique.

En plus de la clé RSA, le serveur communique un token de session `$usr`.

### Échange de clés AES (Rijndael 256)

RSA ne permet pas de chiffrer des messages très long. Le reste des échanges de l'application seront fait chiffrés avec une paire de clés AES.

L'échange de clés AES se fait dans une deuxième requête, générique. Le format binaire de cette requête est le suivant :

| Octets        | Description           |
| ------------- |-------------|
| `01` | Le message contient des infos AES |
| `00 01 00 00` | Taille de la clé AES utilisés, 256 (Low Endian) |
| `...` | La clé AES, chiffrée avec la clé publique du destinataire |
| `20 00 00 00` | Taille du vecteur d'initialisation utilisé, 32 (Low Endian) |
| `...` | Le vecteur d'initialisation |
| `...` | Le payload binaire, chiffré avec la clé AES |

La réponse du serveur est sur le même format.

### Requêtes suivantes

Les requêtes et réponses suivantes suivent toutes le même format.

| Octets        | Description           |
| ------------- |-------------|
| `00` | Le message ne contient pas d'infos AES |
| `...` | Le payload binaire, chiffrée avec la clé AES |

## Échanges binaires

Les payloads utilisés pour appeler les méthodes distantes sont toutes encodés en binaire selon un protocole particulier. Le format généralement utilisé est :

| Octets        | Description           |
| ------------- |-------------|
| `XX` | Le type de contenu |
| `YY` | Taille du contenu à suivre |
| ... | Contenu |

### Exemple

Pour une string, le binaire sera par exemple : `0D 05 00 00 00 68 65 6C 6C 6F`. Ici, `0D` identifie une chaine de caractère, `05 00 00 00` correspond à 5 encodé en low endian, et les 5 octets suivants `68 65 6C 6C 6F` contiennent la string "hello".

### DateTime

Une date est encodée à sur 64 bits partir de l'objet DateTime C#. Elle donne le nombre d'intervalles de 100 nanosecondes depuis le 01/01/0001.
