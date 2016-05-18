# Sila-CLI

## Installation

```
git clone https://github.com/kraynel/sila-cli.git && cd sila-cli && npm install -g
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

## Afficher l'aide
```
Usage: sila-cli [options]

  Options:

    -h, --help                  output usage information
    -V, --version               output the version number
    -u, --username <email>      Your email
    -p, --password <password>   Your password
    -l, --list-only             Only list all available payslips
    -i, --id <payslip-id>       Download the specified payslip
    -d, --date <YYYY-MM>        Download payslip for month
    -o, --output <output-path>  Output path
```

## Protocole

Le procole utilisé est détaillé dans un [fichier séparé](protocol/protocol.md).
