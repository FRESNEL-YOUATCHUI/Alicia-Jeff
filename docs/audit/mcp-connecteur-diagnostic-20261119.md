# Diagnostic MCP Supabase - 19 novembre 2026

Projet vise : mcnpagbcehupdbhshcea (Alicia & Jeff).

## Conclusion

La connexion a la base n'est pas encore validee. Aucune operation SQL, ecriture distante ou migration n'a ete executee pendant ce diagnostic. L'etat de la migration 004 reste indetermine.

## Constats observes

- Le catalogue d'outils de cette conversation expose 36 noms sous mcp__codex_apps__supabase_*. Il s'agit de la passerelle codex_apps ; le nom et le catalogue tools/list du serveur Supabase en amont ne sont pas accessibles par cette seule annonce.
- La recherche du gestionnaire de plugins retourne : name=supabase, scope=GLOBAL, status=ENABLED, installed=false. Ce retour ne prouve pas l'existence d'une session OAuth Supabase active.
- Avant correction locale, codex mcp list --json ne contient que codex_app (desactive), cua_repl et node_repl. Aucune connexion Supabase directe.
- Le fichier global C:/Users/Hp EliteBook/.codex/config.toml ne contenait aucune reference a Supabase ni au projet cible. Aucune preuve disponible sur les parametres features de l'ancien connecteur applicatif.
- Les anciens appels ont echoue avec les erreurs reproduites ci-dessous. Aucun nouvel appel aux memes alias defaillants n'a ete tente pendant ce diagnostic.

## Erreurs observees precedemment

MCP error -32001: Unknown tool({"name":"supabase.get_project"})
MCP error -32001: Unknown tool({"name":"supabase.list_tables"})
MCP error -32001: Unknown tool({"name":"supabase.list_migrations"})

Unknown tool ne permet pas de conclure a un probleme d'organisation ou de permissions sur la base. get_project est normalement absent en mode limite a un projet.

## Connexion officielle preparee et ajoutee localement

Nom : supabase_alicia_jeff_readonly
Transport : streamable_http
Activation locale : enabled=true
URL : https://mcp.supabase.com/mcp?project_ref=mcnpagbcehupdbhshcea&read_only=true&features=database
Configuration : C:/Users/Hp EliteBook/.codex/config.toml
Etat OAuth au dernier controle : not_logged_in
La commande codex mcp add a lance le parcours OAuth, qui attend l'intervention de l'utilisateur dans son navigateur. Aucune valeur de secret, cle de projet ou variable d'environnement serveur n'a ete consultee ou modifiee.

Une requete MCP initialize sans authentifiant a joint l'URL officielle et retourne :
HTTP 401
{"message":"No access token provided"}

Ce test prouve que l'endpoint repond et exige une authentification ; il ne valide ni l'acces au projet ni les permissions du compte.

## Outils annonces dans la conversation

Ces noms sont disponibles dans le catalogue de la passerelle, sans garantie de bon routage vers Supabase :

- mcp__codex_apps__supabase_apply_migration
- mcp__codex_apps__supabase_confirm_cost
- mcp__codex_apps__supabase_create_branch
- mcp__codex_apps__supabase_create_notebook
- mcp__codex_apps__supabase_create_project
- mcp__codex_apps__supabase_delete_branch
- mcp__codex_apps__supabase_delete_feedback
- mcp__codex_apps__supabase_delete_notebook
- mcp__codex_apps__supabase_deploy_edge_function
- mcp__codex_apps__supabase_execute_sql
- mcp__codex_apps__supabase_generate_typescript_types
- mcp__codex_apps__supabase_get_advisors
- mcp__codex_apps__supabase_get_cost
- mcp__codex_apps__supabase_get_edge_function
- mcp__codex_apps__supabase_get_notebook
- mcp__codex_apps__supabase_get_organization
- mcp__codex_apps__supabase_get_project
- mcp__codex_apps__supabase_get_project_url
- mcp__codex_apps__supabase_get_publishable_keys
- mcp__codex_apps__supabase_list_branches
- mcp__codex_apps__supabase_list_edge_functions
- mcp__codex_apps__supabase_list_extensions
- mcp__codex_apps__supabase_list_migrations
- mcp__codex_apps__supabase_list_notebooks
- mcp__codex_apps__supabase_list_organizations
- mcp__codex_apps__supabase_list_projects
- mcp__codex_apps__supabase_list_tables
- mcp__codex_apps__supabase_merge_branch
- mcp__codex_apps__supabase_pause_project
- mcp__codex_apps__supabase_query_logs
- mcp__codex_apps__supabase_rebase_branch
- mcp__codex_apps__supabase_reset_branch
- mcp__codex_apps__supabase_restore_project
- mcp__codex_apps__supabase_run_notebook
- mcp__codex_apps__supabase_search_docs
- mcp__codex_apps__supabase_submit_feedback

## Outils documentes pour le groupe database

list_tables, list_extensions, list_migrations, execute_sql, apply_migration.
Cette liste provient de la documentation, PAS d'un tools/list authentifie de la nouvelle connexion. Les noms effectivement exposes et leurs schemas devront etre lus apres authentification et rechargement de la session.

## Resultats demandes

| Verification | Resultat |
| --- | --- |
| Disponibilite HTTP du serveur officiel | Endpoint joignable ; initialize sans jeton refuse avec HTTP 401 |
| Disponibilite du projet | Non verifiee faute de connexion OAuth validee |
| list_tables | Aucun resultat de base obtenu ; ne pas interpreter comme une liste vide |
| list_migrations | Aucun resultat de base obtenu |
| Migration 004 | Etat inconnu ; non executee |
| Groupe database | Explicitement configure dans la nouvelle URL ; ancien connecteur non verifiable |
| Permissions/organisation | Non verifiees ; aucune preuve d'un refus de permission du compte dans ce diagnostic |

## Suite necessaire

1. Terminer l'autorisation OAuth Supabase dans le navigateur pour supabase_alicia_jeff_readonly, avec le compte ayant acces au projet.
2. Controler l'etat local avec codex mcp list --json. Si la tentative OAuth a expire : codex mcp login supabase_alicia_jeff_readonly.
3. Redemarrer Codex ou ouvrir une nouvelle session qui charge ce serveur. Le serveur ajoute n'apparait pas encore dans ALL_TOOLS de la conversation en cours.
4. Decouvrir tools/list, puis utiliser les vrais outils list_tables et list_migrations exposes par cette connexion. Ne pas exiger get_project pour une connexion limitee au projet.
5. Rester en lecture seule et ne pas appliquer la migration 004 pendant ce diagnostic.

Sources officielles :
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- https://supabase.com/docs/guides/ai-tools/mcp


## Actualisation apres autorisation OAuth

L'utilisateur a termine le parcours OAuth. La commande de connexion s'est terminee avec le code 0 et le message exact :
Successfully logged in to MCP server 'supabase_alicia_jeff_readonly'.

Le controle codex mcp list --json confirme maintenant :
{"name":"supabase_alicia_jeff_readonly","enabled":true,"auth_status":"o_auth"}

L'ancien etat not_logged_in ci-dessus decrit donc uniquement la phase anterieure a l'autorisation. La connexion OAuth est maintenant enregistree ; cela ne prouve pas encore l'acces au projet ni les permissions de base.

Le catalogue ALL_TOOLS de la conversation ne contient toujours aucun outil sous le nom de ce nouveau serveur. Seuls les anciens alias mcp__codex_apps__supabase_* restent annonces. Aucun appel a ces alias defaillants n'a ete repete. Il faut recharger la session Codex pour charger le serveur direct, decouvrir ses outils reels, puis executer list_tables et list_migrations en lecture seule.

Resultats actuels : tables non obtenues ; migrations non obtenues ; migration 004 non executee. Aucun SQL ni changement distant pendant cette actualisation.
