# Sila-CLI

## Installation

Prérequis : Node

```
git clone https://github.com/kraynel/silaexpert.git
cd silaexpert
npm install -g
```

## Télécharger une fiche de paie

Pour télécharger la dernière fiche de paie :
```
sila-cli -u <email> -p <password>
```

Pour avoir la liste des fiches de paie disponibles :
```
sila-cli -u <email> -p <password> -l
```

Pour télécharger une fiche de paie particulière :
```
sila-cli -u <email> -p <password> -d <YYYY-MM>
```
ou
```
sila-cli -u <email> -p <password> -i <id>
```
