@echo off
REM ============================================================
REM  statbel-app - menu developpeur (Windows)
REM  A placer a la RACINE du depot. Lancer :  start-dev.bat
REM  Site statique publie sur GitHub Pages : pousser = deployer.
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

REM Liens
set "URL_APP=https://pmeyssonnier.github.io/statbel-app/"
set "URL_REPO=https://github.com/pmeyssonnier/statbel-app"
set "URL_PRS=https://github.com/pmeyssonnier/statbel-app/pulls"
set "URL_ACTIONS=https://github.com/pmeyssonnier/statbel-app/actions"

REM Port du serveur d'apercu local
set "PORT=8000"

REM ================= MENU PRINCIPAL =================
:menu
cls
set "BRANCH="
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
echo ==================================================
echo    statbel-app - menu developpeur
echo ==================================================
echo    Dossier : %cd%
echo    Branche : %BRANCH%
echo --------------------------------------------------
echo    1. Apercu local (serveur + navigateur)
echo    2. Qualite - verifier les liens
echo    3. Git     - statut, pull, branche, commit/push
echo    4. Prod    - ouvrir site, depot, PR, deploiement
echo    0. Quitter
echo ==================================================
set "choix="
set /p choix="Votre choix : "
if "%choix%"=="1" goto m_lancer
if "%choix%"=="2" goto m_qualite
if "%choix%"=="3" goto m_git
if "%choix%"=="4" goto m_prod
if "%choix%"=="0" goto end
goto menu

REM ================= 1. APERCU LOCAL =================
:m_lancer
cls
echo === APERCU LOCAL ===
echo    1. Lancer le serveur d'apercu (+ navigateur)
echo    2. Arreter le serveur (port %PORT%)
echo    0. Retour
set "c="
set /p c="Choix : "
if "%c%"=="1" goto run
if "%c%"=="2" goto stop
if "%c%"=="0" goto menu
goto m_lancer

:run
echo. & echo Site local -^> http://localhost:%PORT%/
echo.
echo   [PWA] Le service worker (sw.js) sert depuis le CACHE : une modif peut
echo         NE PAS apparaitre au simple rafraichissement. En dev, ouvrir
echo         DevTools -^> Application -^> Service Workers et cocher
echo         "Update on reload" (ou "Bypass for network"), ou desenregistrer le SW.
REM Sert les fichiers de la racine du depot. Si une etape de build existe
REM (Jekyll, Vite, etc.), remplacer la ligne "start" ci-dessous par la
REM commande de build/serve reelle.
start "statbel-app apercu" cmd /k "python -m http.server %PORT%"
timeout /t 2 >nul
start "" "http://localhost:%PORT%/"
echo. & echo Serveur lance dans sa fenetre (fermer / Ctrl+C pour arreter). & echo.
pause & goto m_lancer

:stop
echo.
call :killport %PORT%
echo Termine.
echo.
pause & goto m_lancer

REM ================= 2. QUALITE =================
:m_qualite
cls
echo === QUALITE ===
echo    1. Verifier les liens internes
echo    2. Verifier les liens internes + externes (plus lent)
echo    0. Retour
set "c="
set /p c="Choix : "
if "%c%"=="1" goto links_int
if "%c%"=="2" goto links_all
if "%c%"=="0" goto menu
goto m_qualite

:links_int
if not exist "check_links.py" goto no_checker
echo. & python check_links.py
echo. & pause & goto m_qualite

:links_all
if not exist "check_links.py" goto no_checker
echo. & python check_links.py --external
echo. & pause & goto m_qualite

:no_checker
echo.
echo [ERREUR] check_links.py introuvable a la racine du depot.
echo Depose check_links.py a cote de ce start-dev.bat.
echo.
pause & goto m_qualite

REM ================= 3. GIT =================
:m_git
cls
echo === GIT ===
echo    1. Statut / ecart avec origin/main
echo    2. Recuperer les dernieres modifs (git pull)
echo    3. Tester une branche de PR (fetch + checkout)
echo    4. Committer et pousser  (= deployer sur Pages)
echo    0. Retour
set "c="
set /p c="Choix : "
if "%c%"=="1" goto status
if "%c%"=="2" goto pull
if "%c%"=="3" goto testbranch
if "%c%"=="4" goto commit
if "%c%"=="0" goto menu
goto m_git

:status
echo. & echo Recuperation de l'etat distant (git fetch) ... & git fetch origin --quiet
echo. & echo === Etat local === & git status -sb
echo. & echo === 8 derniers commits === & git log --oneline -8
echo. & echo === Ecart avec origin/main  (gauche=locaux non pousses / droite=distants non recuperes) ===
git rev-list --left-right --count HEAD...origin/main
echo. & pause & goto m_git

:pull
echo. & echo git pull origin main ... & git pull origin main
echo. & pause & goto m_git

:testbranch
echo.
echo Recuperation des branches distantes (git fetch) ...
git fetch origin --prune
echo.
echo Branches distantes :
git branch -r
echo.
set "br="
set /p br="Branche a tester ; 'main' pour revenir ; vide = annuler : "
if "%br%"=="" goto m_git
REM checkout -B : cale la branche locale EXACTEMENT sur la version distante
REM (robuste meme si la branche a ete force-pushee). Necessite un arbre propre.
git checkout -B %br% origin/%br%
echo.
echo Branche active :
git rev-parse --abbrev-ref HEAD
echo. & echo Rafraichis le navigateur pour voir la version de cette branche.
echo. & pause & goto m_git

:commit
echo. & git status -sb & echo.
set "msg="
set /p msg="Message de commit (vide = annuler) : "
if "%msg%"=="" ( echo Annule. & timeout /t 1 >nul & goto m_git )
git add -A
git commit -m "%msg%"
git push
echo.
echo Pousse. GitHub Pages redeploie automatiquement (menu Prod, option 4).
echo. & pause & goto m_git

REM ================= 4. PROD / LIENS =================
:m_prod
cls
echo === PROD / LIENS ===
echo    1. Ouvrir le site (GitHub Pages)
echo    2. Ouvrir le depot
echo    3. Ouvrir les Pull Requests
echo    4. Voir l'etat du deploiement (Actions)
echo    0. Retour
set "c="
set /p c="Choix : "
if "%c%"=="1" start "" "%URL_APP%" & goto m_prod
if "%c%"=="2" start "" "%URL_REPO%" & goto m_prod
if "%c%"=="3" start "" "%URL_PRS%" & goto m_prod
if "%c%"=="4" start "" "%URL_ACTIONS%" & goto m_prod
if "%c%"=="0" goto menu
goto m_prod

REM ================= SOUS-ROUTINES =================
:killport
REM  %1 = port a liberer
set "_found="
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :%1 ^| findstr LISTENING') do (
  echo   arret du PID %%p sur le port %1
  taskkill /PID %%p /F >nul 2>&1
  set "_found=1"
)
if not defined _found echo   rien n'ecoute sur le port %1
exit /b

:end
endlocal
exit /b 0
