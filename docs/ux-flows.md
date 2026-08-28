# Gestinmo — Fluxos UX

Font de veritat dels fluxos d'usuari. Generat a partir de [`CLAUDE.md`](../CLAUDE.md),
[`docs/requirements.md`](requirements.md) i [`docs/architecture.md`](architecture.md)
per l'agent UX Designer. Els agents **UI Components** i **Feature Developer** han de
seguir aquest document sense inventar comportament no descrit aquí.

---

## 1. Patrons de pantalla reutilitzables

Catàleg de patrons que es repeteixen entre mòduls. L'Agent UI Components construeix un
component genèric per a cadascun; l'Agent Feature Developer els compon, no els
reinventa per mòdul.

| Patró | Descripció | Usat a |
|---|---|---|
| **Llistat paginat** | Taula amb cerca, filtres, ordenació, paginació (20/pàgina per defecte) | Tots els mòduls 3.2–3.7 |
| **Detall d'entitat** | Fitxa amb dades principals + seccions/pestanyes relacionades (ex: unitats d'una propietat, rebuts d'un contracte) | Propietats, Propietaris, Inquilins, Contractes |
| **Formulari de creació/edició** | Camps agrupats per secció lògica, validació en línia, desat amb feedback explícit | Tots els mòduls amb escriptura |
| **Wizard multi-pas** | Únicament per a l'alta de contracte (unitat → inquilí(ns) → condicions econòmiques → confirmació), per la quantitat de dades interrelacionades i validacions creuades | Contractes (3.5) |
| **Confirmació d'acció destructiva/irreversible** | Diàleg modal amb el text de la conseqüència explícit, mai un simple "Estàs segur?" genèric | Baixa de propietat/propietari/inquilí, resolució de contracte, resolució d'incidència |
| **Estat buit** | Il·lustració/text + crida a l'acció ("Encara no hi ha cap propietat. Crea la primera.") | Tots els llistats |
| **Estat de càrrega** | Esquelet amb la forma del contingut final (files de taula, fitxa), mai un espinner sol | Tots els llistats i detalls |
| **Estat d'error** | Missatge + acció de reintentar; mai una pantalla en blanc | Tots els llistats i detalls |

---

## 2. Mapa de rutes

Coincident amb l'estructura d'`docs/architecture.md` §2 (`src/app/(dashboard)/**`).

| Mòdul | Ruta base | Llistat | Detall | Creació | Altres |
|---|---|---|---|---|---|
| Auth | `(auth)` | — | — | — | `/login` |
| Propietats | `/propietats` | `/propietats` | `/propietats/[id]` | `/propietats/nou` | — |
| Propietaris | `/propietaris` | `/propietaris` | `/propietaris/[id]` | `/propietaris/nou` | — |
| Inquilins | `/inquilins` | `/inquilins` | `/inquilins/[id]` | `/inquilins/nou` | — |
| Contractes | `/contractes` | `/contractes` | `/contractes/[id]` | `/contractes/nou` | — |
| Pagaments | `/pagaments` | `/pagaments` | `/pagaments/[id]` | — (es generen, no es creen a mà) | `/pagaments/remeses` |
| Incidències | `/incidencies` | `/incidencies` | `/incidencies/[id]` | `/incidencies/nou` | — |
| Informes | `/informes` | — (és el propi dashboard) | — | — | `/informes` |
| Configuració (Auth & Multitenancy, 3.1) | `/configuracio` | — | — | — | Dades del tenant, usuaris interns |
| Portal del llogater [fase final] | `(portal)` | — | — | — | Vegeu §3.9 |

---

## 3. Fluxos per mòdul

### 3.1 Auth & Multitenancy

**Punt d'entrada**: `/login`, accessible sense sessió; qualsevol ruta de `(dashboard)`
sense JWT vàlid hi redirigeix.

**Flux principal (login)**:
1. L'usuari introdueix email i contrasenya a `/login`.
2. Enviar → estat de càrrega al botó (`useFormStatus`).
3. Èxit → redirecció a `/informes` (dashboard per defecte).
4. Error de credencials → missatge genèric sota el formulari (§3.1 "Missatges
   d'error"), el formulari no es buida el camp email.

**Flux principal (configuració del tenant, només Administrador)**:
1. Des del menú, accedir a `/configuracio`.
2. Pestanya "Agència": nom, dades fiscals, expiració de sessió JWT.
3. Pestanya "Usuaris": llistat d'usuaris interns amb rol, estat (actiu/desactivat),
   últim login. Accions: crear usuari (email + rol), desactivar, reenviar invitació.

**Estats de pantalla**:
- `/login`: idle → enviant → error (missatge) / èxit (redirecció).
- `/configuracio` → "Usuaris": llistat (patró llistat paginat), buit només si mai s'ha
  convidat cap usuari (impossible en producció, ja que l'admin sempre existeix — no cal
  estat buit real, però sí "carregant"/"error").

**Missatges d'error**:
| Restricció (`docs/requirements.md`) | Missatge |
|---|---|
| Credencials incorrectes | "Email o contrasenya incorrectes." (mai distingir quin dels dos falla) |
| Compte bloquejat per intents fallits | "Compte bloquejat temporalment per massa intents. Torna-ho a provar d'aquí uns minuts." |
| Usuari desactivat | "Aquest compte està desactivat. Contacta amb l'administrador de la teva agència." |
| Sessió expirada durant l'ús | Banner global (§4) + redirecció a `/login` conservant la ruta d'origen per tornar-hi després |

**Navegació**: des de `/configuracio` no hi ha sortida cap a altres mòduls (és
autocontingut). El logout és accessible des de qualsevol pantalla del `(dashboard)`, al
menú d'usuari.

**Permisos visibles**: `/configuracio` només apareix al menú per a `admin`. La resta de
rols que hi naveguin directament per URL reben una pàgina 403 (§4).

---

### 3.2 Propietats

**Punt d'entrada**: element de menú "Propietats" (visible per `admin`/`gestor`/`comptable`,
lectura per a aquest últim).

**Flux principal**:
1. `/propietats` — llistat amb filtre per tipus, població i estat d'unitats.
2. "Nova propietat" (`admin`/`gestor`) → `/propietats/nou` — formulari (referència,
   tipus, adreça, característiques).
3. Desar → redirecció a `/propietats/[id]`.
4. Des del detall, secció "Unitats" — llistat de les unitats d'aquesta propietat amb el
   seu estat, i acció "Afegir unitat" (formulari inline o modal: referència, planta,
   porta, superfície, renda base).
5. Cada unitat de la llista enllaça al seu contracte actiu si n'hi ha (secció 3.5).

**Estats de pantalla**: llistat (buit/carregant/error/amb dades); detall
(carregant/error/dades, amb la subsecció d'unitats amb el seu propi buit —"Aquesta
propietat encara no té unitats. Afegeix-ne una."—, carregant i error independents).

**Missatges d'error**:
| Restricció | Missatge |
|---|---|
| Baixa de propietat amb unitats amb contracte actiu | "No es pot donar de baixa aquesta propietat: té unitats amb un contracte actiu. Resol o finalitza els contractes primer." |
| Referència de propietat duplicada | "Ja existeix una propietat amb aquesta referència." |
| Intent de canviar manualment l'estat d'una unitat ocupada | "L'estat d'aquesta unitat es gestiona automàticament mentre tingui un contracte actiu." (el control d'estat es mostra desactivat, no amagat, amb aquest missatge en un tooltip) |

**Navegació**: des d'una unitat → contracte actiu (si n'hi ha) a `/contractes/[id]`;
des d'una propietat → propietari(s) (secció "Titularitat") a `/propietaris/[id]`.

**Permisos visibles**: "Nova propietat", "Afegir unitat" i "Donar de baixa" només
visibles per a `admin`/`gestor`. `comptable` veu el llistat i el detall en només
lectura, sense cap d'aquests controls renderitzats.

---

### 3.3 Propietaris

**Punt d'entrada**: menú "Propietaris".

**Flux principal**:
1. `/propietaris` — llistat amb cerca per nom/NIF.
2. "Nou propietari" → `/propietaris/nou` — tipus (física/jurídica), dades
   identificatives, dades de contacte, IBAN.
3. Des del detall (`/propietaris/[id]`), secció "Propietats" amb el percentatge de
   titularitat de cadascuna; acció "Associar propietat" que obre un selector +
   percentatge, amb indicador en temps real de "Falta un X% per arribar al 100%" fins
   que la suma dels copropietaris quadri.
4. Secció "Liquidacions" amb l'històric de rendes generades en un període.

**Estats de pantalla**: llistat i detall estàndard; la secció "Propietats" mostra un
indicador visual quan la suma de percentatges és diferent de 100% (abans de desar).

**Missatges d'error**:
| Restricció | Missatge |
|---|---|
| Suma de percentatges de titularitat ≠ 100% en desar | "Els percentatges de titularitat d'aquesta propietat sumen X%, han de sumar exactament 100%." |
| Baixa de propietari amb propietats actives associades | "No es pot donar de baixa aquest propietari: encara té propietats associades. Elimina primer la seva titularitat o transfereix-la." |
| NIF/CIF duplicat dins del tenant | "Ja existeix un propietari amb aquest NIF/CIF." |

**Navegació**: des d'una fila de "Propietats" del detall → `/propietats/[id]`.

**Permisos visibles**: creació/edició/baixa i gestió de titularitat només per a
`admin`/`gestor`; `comptable` només lectura (útil per contextualitzar una liquidació).

---

### 3.4 Inquilins

**Punt d'entrada**: menú "Inquilins".

**Flux principal**:
1. `/inquilins` — llistat amb filtre per estat (actiu / moros / inactiu) i cerca per
   nom/NIF.
2. "Nou inquilí" → `/inquilins/nou` — dades personals i de contacte, documents
   (DNI/NIE, nòmines, avals).
3. Des del detall (`/inquilins/[id]`), secció "Contractes" amb l'històric complet
   (passats i actuals) — **pot mostrar més d'una fila amb estat `actiu` simultàniament**
   si l'inquilí lloga més d'una unitat alhora (ex: pis + parking), cosa que no és un
   error.
4. Badge d'estat de mora ben visible a la capçalera del detall quan `estat = moros`,
   amb enllaç directe als rebuts pendents que l'han causat.

**Estats de pantalla**: llistat i detall estàndard; l'estat "moros" es destaca amb color
d'alerta consistent amb `docs/ux-flows.md` §1 i el sistema de disseny de l'Agent UI
Components.

**Missatges d'error**:
| Restricció | Missatge |
|---|---|
| Baixa d'inquilí amb contracte actiu | "No es pot donar de baixa aquest inquilí: té un contracte actiu. Finalitza o resol el contracte primer." |
| NIF/CIF duplicat | "Ja existeix un inquilí amb aquest NIF/NIE." |

**Navegació**: des d'una fila de "Contractes" del detall → `/contractes/[id]`; des del
badge de mora → `/pagaments` filtrat per aquest inquilí i estat vençut/mora.

**Permisos visibles**: creació/edició/baixa només `admin`/`gestor`; `comptable` només
lectura. El **llogater** (portal, fase final) només veu i edita les seves pròpies dades
de contacte — vegeu §3.9.

---

### 3.5 Contractes

**Punt d'entrada**: menú "Contractes", o des d'una unitat vacant a `/propietats/[id]`
("Crear contracte per a aquesta unitat").

**Flux principal (wizard d'alta, patró "Wizard multi-pas")**:
1. **Pas 1 — Unitat**: seleccionar la unitat (preseleccionada si es ve des d'una
   propietat); només es poden triar unitats sense contracte actiu.
2. **Pas 2 — Inquilins**: afegir un o més inquilins (cercador + "Crear inquilí nou"
   inline si no existeix).
3. **Pas 3 — Condicions**: tipus d'ús (habitatge / local / parking / industrial /
   altres), data d'inici, durada, renda, fiança (amb validació en viu: si l'ús és
   "habitatge", el camp fiança mostra el rang vàlid 1–2 mensualitats i avisa si es surt
   d'aquest rang; per a altres usos, el camp és lliure sense avís), índex d'actualització.
4. **Pas 4 — Confirmació**: resum editable de tot l'anterior; "Crear com a esborrany" o
   "Crear i activar" (aquesta segona opció desactivada, amb missatge, si la unitat ha
   deixat de ser vàlida entre passos per una acció concurrent d'un altre usuari).
5. Des del detall (`/contractes/[id]`), accions: "Activar" (si `esborrany`), "Renovar"
   (pròrroga), "Resoldre" (motiu + data efectiva), "Generar PDF".
6. Secció "Rebuts" amb el calendari de pagaments generats per aquest contracte.

**Estats de pantalla**: cada pas del wizard valida abans de permetre avançar; el pas 3
mostra en temps real el resultat del càlcul de rang de fiança. Detall amb
carregant/error/dades i secció de rebuts amb el seu propi buit ("Encara no s'ha generat
cap rebut per a aquest contracte.").

**Missatges d'error**:
| Restricció (`docs/requirements.md` §5) | Missatge |
|---|---|
| La unitat ja té un contracte actiu (regla #2) | "Aquesta unitat ja té un contracte actiu. Finalitza'l o resol-lo abans de crear-ne un de nou." (bloquejat al pas 1, la unitat ni apareix com a seleccionable) |
| Fiança fora de rang per a habitatge (regla #4) | "Per a un contracte d'habitatge, la fiança ha d'estar entre 1 i 2 mensualitats (entre {renda}€ i {renda×2}€)." |
| Data de fi anterior o igual a la d'inici | "La data de finalització ha de ser posterior a la data d'inici." |
| Intent de reactivar un contracte resolt | Acció "Activar" no disponible (botó no renderitzat) per a contractes en estat `resolt`/`finalitzat`; cal crear-ne un de nou |

**Navegació**: des del pas 1 del wizard → crear propietat/unitat nova si no existeix
(enllaç a `/propietats/nou`, obre en una pestanya/flux paral·lel per no perdre el
progrés del wizard). Des de "Rebuts" → `/pagaments/[id]`.

**Permisos visibles**: creació, activació, renovació i resolució només
`admin`/`gestor`. `comptable` veu el detall i les condicions econòmiques en només
lectura, sense el wizard d'alta ni les accions d'estat.

---

### 3.6 Pagaments

**Punt d'entrada**: menú "Pagaments".

**Flux principal**:
1. `/pagaments` — llistat amb filtres per estat (pendent, vençut, mora, cobrat...),
   contracte, rang de dates de venciment.
2. Acció ràpida per fila: "Marcar com a cobrat" (obre un diàleg petit: data, mètode) —
   optimistic update visual immediat.
3. Selecció múltiple de files → "Agrupar en remesa" → `/pagaments/remeses` per gestionar
   l'enviament.
4. Des del detall (`/pagaments/[id]`): historial de canvis d'estat, opció d'anul·lar
   (soft delete, només si `cobrat`, amb confirmació destructiva i motiu obligatori).
5. Acció "Generar liquidació" (per propietari i període) accessible des del llistat o
   des del detall d'un propietari.

**Estats de pantalla**: llistat estàndard (amb indicador visual de "vençut"/"mora"
destacat en color d'alerta); el diàleg de cobrament té el seu propi estat
d'enviament/error.

**Missatges d'error**:
| Restricció | Missatge |
|---|---|
| Intent d'anul·lar un rebut no cobrat | Acció "Anul·lar" no disponible per a rebuts en estat diferent de `cobrat` (no té sentit anul·lar el que no s'ha cobrat: s'edita o s'elimina si és un error de generació) |
| Import de cobrament diferent de l'import del rebut sense justificació | Avís (no bloquejant) "L'import introduït no coincideix amb el rebut. Confirma que és correcte." |
| Rebut vençut > 30 dies (regla #5) | Badge "Mora" a la fila i al detall, amb enllaç a l'inquilí afectat; no és un error d'usuari, és informatiu |

**Navegació**: des d'una fila → `/pagaments/[id]`; des del detall → `/contractes/[id]`
del contracte associat; des del badge de mora → `/inquilins/[id]`.

**Permisos visibles**: `comptable` té accés total (lectura + escriptura) a tot aquest
mòdul — és l'únic mòdul on el seu rol iguala `admin`/`gestor`. `gestor` també hi té
accés total. Cap altre rol intern hi té accés d'escriptura.

---

### 3.7 Incidències

**Punt d'entrada**: menú "Incidències", o des d'una unitat/contracte ("Reportar
incidència").

**Flux principal**:
1. `/incidencies` — llistat amb filtre per estat, prioritat, unitat.
2. "Nova incidència" → `/incidencies/nou` — unitat (preseleccionada si es ve des d'una
   unitat/contracte), títol, descripció, prioritat.
3. Des del detall (`/incidencies/[id]`): assignar a un usuari intern, canviar d'estat
   (oberta → assignada → en_curs → resolta), afegir comentaris i adjunts, registrar cost
   estimat/final.
4. Marcar "Resolta" — diàleg de confirmació (patró destructiu/irreversible, ja que no es
   pot desfer) amb resum de l'acció.

**Estats de pantalla**: llistat i detall estàndard; el fil de comentaris té el seu propi
estat de càrrega/error, independent del de la fitxa principal.

**Missatges d'error**:
| Restricció (regla #6) | Missatge |
|---|---|
| Intent de reobrir una incidència resolta | El control de canvi d'estat es desactiva per a incidències `resolta`, amb el missatge "Aquesta incidència ja està resolta i no es pot reobrir. Crea'n una de nova si el problema persisteix." i un botó directe "Crear incidència relacionada" que preomple unitat/contracte |
| Comentari buit | "Escriu un comentari abans d'enviar-lo." (validació client, no cal arribar a l'API) |

**Navegació**: des del detall → unitat (`/propietats/[id]`, secció unitats) i, si
n'hi ha, contracte (`/contractes/[id]`) associats.

**Permisos visibles**: creació, assignació i gestió d'estat per `admin`/`gestor`.
`comptable` només veu el cost si n'hi ha, en només lectura (per repercutir-lo a la
liquidació del propietari), sense la resta de la fitxa operativa desplegada per
defecte. El **llogater** (portal, fase final) pot crear i fer seguiment només de les
incidències que ell mateix ha reportat — vegeu §3.9.

---

### 3.8 Informes & Dashboard

**Punt d'entrada**: menú "Informes" (ruta per defecte en entrar a l'aplicació).

**Flux principal**:
1. `/informes` — quadre d'indicadors: ocupació (% unitats ocupades), morositat (import i
   nombre d'inquilins en mora), ingressos previstos vs. cobrats del mes/període
   seleccionat, incidències obertes per prioritat.
2. Filtres globals de la pàgina: rang de dates, propietat, propietari.
3. Cada indicador enllaça al llistat filtrat corresponent (ex: clicar "Incidències
   obertes: 4" porta a `/incidencies?estat=oberta`).
4. Acció "Exportar" (CSV/PDF) disponible a cada llistat del sistema (Propietats,
   Contractes, Pagaments, Incidències), no només aquí — es documenta centralitzadament
   en aquest mòdul perquè és transversal.

**Estats de pantalla**: cada targeta d'indicador té el seu propi estat de
càrrega/error independent (un indicador que triga no bloqueja la resta del dashboard).

**Missatges d'error**:
| Cas | Missatge |
|---|---|
| Exportació fallida | "No s'ha pogut generar l'exportació. Torna-ho a provar." (toast, no bloqueja la pàgina) |
| Rang de dates invàlid als filtres | "La data d'inici ha de ser anterior a la data de fi." |

**Navegació**: cada indicador/targeta és un punt d'entrada cap al mòdul corresponent amb
filtres ja aplicats.

**Permisos visibles**: `admin` i `comptable` hi tenen accés total; `gestor` només
lectura (indicadors operatius del seu àmbit, sense el detall econòmic de liquidacions
si `docs/requirements.md` §2.2 no li'n dona accés). El **llogater** no hi té accés.

---

### 3.9 Portal del llogater [fase final]

Descrit a nivell de flux per completesa, encara que la implementació és una fase
posterior (`docs/requirements.md` §3.9, `docs/architecture.md` §9).

**Punt d'entrada**: `(portal)/login`, domini/ruta separada del `(dashboard)` intern;
accés només per invitació prèvia del gestor.

**Flux principal**:
1. Login amb credencials pròpies (no comparteix usuari amb `tenant_users`).
2. Pantalla d'inici: contracte(s) actiu(s) i el seu estat de rebuts.
3. "Els meus rebuts": històric amb estat, sense accions d'edició.
4. "Les meves incidències": llistat de les creades pel propi llogater + "Nova
   incidència" (unitat preseleccionada, sense poder triar-ne una altra).
5. Descàrrega de PDF de contracte i rebuts.

**Estats de pantalla**: anàlogues als patrons de §1, amb l'"Estat buit" adaptat
("Encara no tens cap incidència oberta").

**Missatges d'error**: "El teu accés ha estat revocat perquè el contracte ha finalitzat.
Pots continuar consultant el teu històric." (accés de només lectura un cop revocat,
segons la restricció de `docs/requirements.md` §3.9).

**Navegació**: autocontinguda; sense enllaços cap al `(dashboard)` intern.

**Permisos visibles**: el llogater mai veu dades d'altres inquilins, propietaris ni
informació econòmica interna de l'agència — no hi ha cap control d'UI que ho exposi,
ni que calgui amagar (les dades no arriben mai a aquest client).

---

## 4. Missatges d'error globals

No lligats a un mòdul concret, coherents amb els codis HTTP d'`docs/architecture.md` §5.2:

| Codi | Situació | Missatge |
|---|---|---|
| 400 | Validació de formulari fallida | Missatge específic per camp, sota cada input (mai un únic missatge genèric dalt de tot) |
| 401 | Sessió expirada/token invàlid | Banner: "La teva sessió ha caducat. Torna a iniciar sessió." + redirecció a `/login`, conservant la ruta d'origen |
| 403 | Acció o pàgina sense permís pel rol | Pàgina/diàleg: "No tens permisos per accedir a aquesta secció." (mai s'arriba aquí per navegació normal, ja que els controls sense permís no es renderitzen — només per accés directe per URL) |
| 404 | Recurs no trobat (o d'un altre tenant) | "No s'ha trobat el que cerques." + botó de tornar al llistat del mòdul |
| 409 | Conflicte amb regla de negoci | Missatge específic de la regla (vegeu taules per mòdul a §3); mai el detall intern de PostgreSQL |
| 500 | Error inesperat | "S'ha produït un error inesperat. Torna-ho a provar d'aquí una estona." + acció de reintentar |
| Sense connexió | Fetch fallit per xarxa | Banner persistent: "Sense connexió. Alguns canvis no es desaran fins que es recuperi." |

---

## 5. Navegació i estructura de menú

**Ordre del menú principal** (segueix l'ordre de desenvolupament de `CLAUDE.md`):
Informes (dashboard, arrel), Propietats, Propietaris, Inquilins, Contractes, Pagaments,
Incidències, Configuració (només `admin`).

**Adaptació per rol** (`docs/requirements.md` §2.2): l'entrada de menú apareix sempre
que el rol tingui com a mínim lectura al mòdul; les accions d'escriptura dins de cada
pantalla es renderitzen o no segons la matriu, com es detalla mòdul a mòdul a §3.
`comptable` veu totes les entrades excepte "Configuració"; `gestor` veu totes excepte
"Configuració" (que és només lectura de facto perquè no hi té accés).

**Capçalera de context**: nom de l'agència (tenant) sempre visible; no hi ha selector
de tenant perquè un usuari intern pertany a una única agència
(`docs/requirements.md` §3.1). Menú d'usuari amb nom, rol i "Tancar sessió".

**Breadcrumbs**: a totes les pantalles de detall i formulari, format
`[Mòdul] / [Entitat concreta]`, ex: `Contractes / Pis 2n 1a — Carrer Major, 12`.

---

## 6. Accessibilitat

Directrius accionables que tradueixen el requisit no funcional d'accessibilitat
(`docs/requirements.md` §4):

- **Focus visible**: tot element interactiu (botó, enllaç, input, fila de taula
  clicable) té un estat de focus visualment diferenciat; mai `outline: none` sense
  substitut.
- **Ordre de tabulació**: als formularis, l'ordre de tabulació segueix l'ordre visual
  dels camps (esquerra-a-dreta, dalt-a-baix); als wizards (Contractes), `Tab` no permet
  saltar a un pas posterior no habilitat.
- **Etiquetes obligatòries**: cap input sense `<label>` associat; els camps obligatoris
  es marquen textualment ("obligatori"), no només amb un asterisc de color.
- **Contrast**: text i icones informatives (badges d'estat) compleixen almenys AA de
  WCAG 2.1; l'estat "mora"/"vençut" no es comunica només amb color vermell — porta
  també text o icona.
- **`aria-live`** per a confirmacions dinàmiques sense recàrrega de pàgina: "Rebut
  marcat com a cobrat", "Incidència assignada a X" — anunciades als lectors de
  pantalla sense necessitat de moure el focus.
- **Diàlegs de confirmació**: el focus es mou automàticament al diàleg en obrir-se i
  torna a l'element que l'ha obert en tancar-se; `Esc` el tanca sempre.
- **Formularis crítics** (login, alta de contracte, cobrament d'un rebut): navegables
  íntegrament amb teclat, sense dependre del ratolí en cap pas.
