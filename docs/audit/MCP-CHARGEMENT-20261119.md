# Diagnostic du chargement MCP Supabase - 19 novembre 2026

## Resultat

La connexion existante supabase_alicia_jeff_readonly fonctionne dans un client de diagnostic officiel Codex neuf. Aucune connexion ni autorisation OAuth n'a ete recreee. Le serveur reste absent du registre MCP de la conversation active. Les tables, migrations, fonctions et permissions de la base n'ont pas pu etre lues.

## Configuration effective et portee

- Codex CLI : 0.169.0-alpha.11.1.
- Desktop : 26.1111.2228.0, selon codex doctor.
- Nom configure : supabase_alicia_jeff_readonly.
- Portee utilisateur : C:/Users/Hp EliteBook/.codex/config.toml.
- Modification du fichier global : 2026-11-19 02:26:40 UTC.
- Aucune configuration de projet .codex/config.toml dans Downloads/project ni dans Downloads/alicia-jeff-site-local-v3.
- URL exacte : https://mcp.supabase.com/mcp?project_ref=mcnpagbcehupdbhshcea&read_only=true&features=database
- enabled=true ; OAuth enregistre : o_auth.
- Aucun enabled_tools/disabled_tools specifique sur ce serveur.
- config/read, interroge dans un client officiel App Server neuf avec le repertoire du vrai projet, confirme le serveur et l'URL. Les couches resolues comprennent user (fichier ci-dessus) et system (C:/ProgramData/OpenAI/Codex/config.toml).
- Ce config/read est celui du client de diagnostic neuf, et non une lecture directe de la configuration memoire de l'ancien processus Desktop. Cette distinction est essentielle.

## Decouverte reelle reussie

Le client de diagnostic a lance codex app-server --stdio et utilise initialize puis mcpServerStatus/list, limite au seul serveur, detail=toolsAndAuthOnly. Aucun agent ni nouvelle conversation n'a ete cree.

Reponse :
- name : supabase_alicia_jeff_readonly
- authStatus : oAuth
- httpOrigin : https://mcp.supabase.com
- serverInfo.name : supabase
- serverInfo.version : 0.17.0
- toolsError : null
- runtimeStatus : null (decouverte globale, sans conversation chargee ; ne pas interpreter comme une connexion de conversation validee)

Noms reels des quatre outils :
- list_tables (schemas, verbose ; aucun project_id car le serveur est deja limite au projet)
- list_migrations (aucun argument)
- list_extensions
- execute_sql (query)

apply_migration et get_project ne sont pas exposes dans cette connexion. L'absence de get_project est normale pour une connexion limitee a un projet.

## Etat reel de la conversation et journaux

Le registre MCP de la conversation actuelle retourne :
unknown MCP server 'supabase_alicia_jeff_readonly'

Le processus principal App Server Desktop, PID 11820, a demarre le 2026-11-18 a 12:38:48 UTC, avant l'ajout du serveur. Son seul parametre MCP explicite detecte est mcp_servers.codex_app.enabled. Aucun remplacement vide de la carte mcp_servers ni parametre de lancement specifique Supabase n'a ete detecte.

Le journal Desktop du 19 novembre, fichier finissant par 18108-t0-i1-000026-0.log, contient :
- ligne 3109, 08:07:17.132 UTC : echec de decouverte de supabase_alicia_jeff_readonly, authStatus=notLoggedIn, erreur 'Auth required, when send initialize request'.
- ligne 3443, 08:16:02.532 UTC : 'MCP startup failed: timed out handshaking with MCP server after 29.9999996s: deadline has elapsed'.
- ligne 3679, 08:18:15.800 UTC : echec de demarrage de codex_app apres 10 secondes pour la conversation actuelle. Il s'agit d'un autre serveur ; ne pas le confondre avec Supabase.
- ligne 3694 : une requete mcpServerStatus/list pour la conversation actuelle a ete routee. Le journal ne fournit pas sa reponse complete.

Ces observations montrent des echecs de decouverte dans l'application ancienne ; le test neuf reussi prouve que la connexion OAuth et la decouverte peuvent maintenant fonctionner. Elles ne demontrent pas encore les droits du compte sur les tables du projet.

## Diagnostics officiels et limites

Commandes utilisees : codex --help ; codex --version ; codex mcp --help ; codex mcp get ... --json ; codex doctor --json ; codex app-server --help ; codex app-server generate-json-schema ; codex app-server daemon version.

codex doctor charge la configuration sans erreur de syntaxe et recense deux serveurs de configuration. Son avertissement MCP concerne node_repl et une variable d'environnement absente, pas Supabase. Il indique explicitement que les overrides du thread actif ne sont pas inspectes.

Le daemon partage n'est pas actif et son dossier de socket de controle n'existe pas. codex app-server daemon version retourne :
Error: failed to connect to C:\Users\Hp EliteBook\.codex\app-server-control\app-server-control.sock
Caused by:
Une operation de socket a rencontre un reseau inactif. (os error 10050)

Cette erreur concerne le canal de controle local du daemon, pas la disponibilite Internet de Supabase, dont la decouverte a reussi dans le client neuf. Aucun daemon n'a ete demarre ou arrete.

Le protocole officiel documente config/mcpServer/reload pour recharger la configuration et demander le rafraichissement des threads charges. Il n'existe pas de sous-commande codex mcp reload dans cette installation. Le client de diagnostic ne dispose pas d'un canal de controle accessible vers le processus Desktop proprietaire de la conversation ; aucun faux rechargement d'une autre instance n'a ete presente comme un rechargement de cette conversation.

## Tentative de lecture depuis le client officiel neuf

Les appels mcpServer/tool/call exigent une conversation chargee. Une verification de cette conversation depuis le client neuf retourne :
{"code":-32600,"message":"thread not found: 01a1d579-bcd4-7223-a777-83f96adae148"}

La tentative de charger la meme conversation, sans creer de nouvelle conversation ni lancer de tour d'agent, retourne :
{"code":-32600,"message":"thread 01a1d579-bcd4-7223-a777-83f96adae148 already has an active writer"}

Le verrou a ete respecte. Aucune reprise forcee, aucun arret du processus proprietaire, aucun appel SQL et aucun outil de mutation n'ont ete utilises.

## Passerelle Supabase existante : lectures de remplacement testees

Les deux lectures ont ete limitees au projet mcnpagbcehupdbhshcea. Les schemas demandes pour list_tables etaient uniquement public, verbose=false.

mcp__codex_apps__supabase_list_tables retourne :
Mcp error: -32001: Unknown tool({"name":"supabase.list_tables"})

mcp__codex_apps__supabase_list_migrations retourne :
Mcp error: -32001: Unknown tool({"name":"supabase.list_migrations"})

La passerelle existante n'est donc pas actuellement un remplacement valide. Son catalogue/routage doit etre actualise afin de transmettre des noms acceptes par son serveur. Aucune modification de cette passerelle n'a ete effectuee.

## Resultats base et migration 004

- Tables public : aucun resultat de base obtenu.
- Migrations appliquees : aucun resultat de base obtenu.
- Presence et identifiant distant de 004 : indetermines.
- Definitions et permissions hebergees des quatre fonctions : non verifiees.
- Fichier local attendu : supabase/migrations/004_ticket_entry.sql, SHA-256 6308483d162d805f019b607335f128446251e8eec33392102a0c25fe99ab53cf (controle lors de la verification precedente).
- Objets attendus localement : wedding_ticket_entries ; wedding_api_confirm(jsonb,text) ; wedding_api_ticket_restore(text,text) ; wedding_api_ticket_lookup(text) ; wedding_api_ticket_enter(text,timestamptz,text).
- Aucune inference d'absence de migration a partir de l'echec du connecteur.

## Suite proposee, sans modification realisee

La connexion est deja presente au niveau utilisateur et son OAuth doit etre conserve. Une conversation nouvelle chargee apres authentification est l'etape adaptee pour eviter le registre ancien de cette conversation. Un simple retour a cette meme conversation n'a pas suffi.

Alternative officielle avec un processus neuf, sans daemon partage :
codex --no-daemon -C "C:\Users\Hp EliteBook\Downloads\alicia-jeff-site-local-v3"

Dans ce client, demander exclusivement les outils de supabase_alicia_jeff_readonly : list_tables schemas=[public], verbose=false ; list_migrations ; puis execute_sql limite a des SELECT de catalogues pour les definitions, RLS et privileges des objets de 004. Ne pas lancer la migration.

Pour conserver la passerelle codex_apps, proposer la correction de son catalogue/routage, puis retester les deux outils en lecture seule. Cette option n'est pas annoncee comme fonctionnelle tant que Unknown tool persiste.

Aucune migration, ecriture SQL, modification de donnees, de secrets, d'OAuth, de configuration de production ou deploiement pendant ce diagnostic.

Documentation officielle :
https://learn.chatgpt.com/docs/app-server
https://supabase.com/docs/guides/ai-tools/mcp

