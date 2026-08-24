# Gestinmo — Requisits del producte

## 1. Visió i objectiu

Gestinmo és una webapp multitenant de gestió immobiliària adreçada a agències de lloguer i propietaris particulars amb cartera. L'objectiu és centralitzar en una sola eina tot el cicle de vida de l'activitat de lloguer: propietats i unitats, propietaris, inquilins, contractes, pagaments, incidències i informes, oferint alhora un portal extern perquè el llogater pugui consultar la seva situació sense intervenció del gestor.

**Problema que resol:** avui aquesta gestió es fa sovint amb fulls de càlcul, correu electrònic i eines desconnectades entre si, cosa que provoca errors de seguiment de rendes, mora no detectada a temps, incidències perdudes i falta de traçabilitat davant d'auditories o inspeccions.

**Objectiu del producte:**
- Donar a cada agència (tenant) un espai aïllat i segur per gestionar tota la seva cartera.
- Automatitzar el càlcul i seguiment de rendes, actualitzacions per IPC i detecció de mora.
- Oferir traçabilitat completa (auditoria) de qualsevol modificació sobre dades sensibles.
- Reduir el temps operatiu del gestor mitjançant llistats, filtres i informes ràpids.
- Facilitar el compliment normatiu (RGPD, documentació de contractes i fiances).

**Fora d'abast (per ara):** facturació electrònica amb administracions públiques, integració amb pagaments online (passarel·la de cobrament), gestió d'obres/reformes, CRM comercial de captació de propietats.

---

## 2. Usuaris i rols

### 2.1 Definició de rols

| Rol | Descripció |
|---|---|
| **Administrador** | Usuari amb accés total al tenant. Gestiona configuració, usuaris, permisos i totes les dades de l'agència. |
| **Gestor** | Usuari operatiu del dia a dia: propietats, propietaris, inquilins, contractes, incidències. Sense accés a configuració del tenant ni gestió d'usuaris. |
| **Comptable** | Accés restringit a l'àrea econòmica: pagaments, rebuts, morositat i informes. Consulta la resta de mòduls en només lectura quan calgui per contextualitzar un pagament. |
| **Portal llogater** [fase final] | Usuari extern (inquilí) amb accés limitat a les seves pròpies dades: contracte, rebuts i incidències pròpies. |

### 2.2 Matriu de permisos

Llegenda: `T` = total (lectura + escriptura), `L` = només lectura, `-` = sense accés.

| Mòdul | Administrador | Gestor | Comptable | Portal llogater |
|---|---|---|---|---|
| Auth & Multitenancy (config. tenant, usuaris) | T | - | - | - |
| Propietats | T | T | L | - |
| Propietaris | T | T | L | - |
| Inquilins | T | T | L | L (propi) |
| Contractes | T | T | L | L (propi) |
| Pagaments | T | T | T | L (propi) |
| Incidències | T | T | L | T (crear i consultar les pròpies) |
| Informes & Dashboard | T | L | T | - |
| Portal del llogater (gestió de comptes d'accés) | T | L | - | - |

**Notes:**
- El rol **Administrador** és l'únic que pot crear/desactivar usuaris interns i gestionar la configuració del tenant (JWT, dades fiscals de l'agència, etc.).
- El rol **Comptable** pot veure el detall d'una incidència si aquesta té cost associat, però no pot editar-la.
- El **Portal llogater** només veu i opera sobre les seves pròpies dades (contracte actiu i històric, rebuts propis, incidències que ell mateix ha creat). No té visibilitat sobre altres inquilins ni sobre dades econòmiques del propietari.

---

## 3. Mòduls funcionals

### 3.1 Auth & Multitenancy

**Descripció breu:** gestiona l'autenticació d'usuaris interns, la creació i configuració de tenants (agències) i l'aïllament complet de dades entre agències.

**Entitats principals:** `Tenant`, `Usuari`, `Sessio`, `Rol`

**Funcionalitats:**
- L'usuari pot iniciar sessió amb email i contrasenya.
- L'usuari pot tancar sessió des de qualsevol pantalla.
- L'administrador pot crear nous usuaris dins del seu tenant i assignar-los un rol.
- L'administrador pot desactivar o eliminar usuaris.
- L'administrador pot configurar paràmetres del tenant (nom d'agència, dades fiscals, expiració de sessió JWT).
- El sistema pot renovar el token JWT de forma transparent mentre la sessió estigui activa.
- El sistema pot bloquejar l'accés després d'un nombre configurable d'intents fallits de login.

**Restriccions:**
- Cada usuari pertany a un únic tenant; no hi ha usuaris compartits entre agències.
- Les contrasenyes es desen sempre amb hash (`bcryptjs`), mai en text pla.
- Un usuari desactivat no pot iniciar sessió encara que conegui les credencials.
- El token JWT ha de portar `tenant_id` i `rol` per validar cada petició.

**Estats possibles:**
- `Usuari`: convidat → actiu → desactivat
- `Sessio`: activa → expirada → revocada

**Integracions:** tots els mòduls depenen d'Auth & Multitenancy per resoldre `tenant_id` i permisos abans de qualsevol operació.

---

### 3.2 Propietats

**Descripció breu:** gestiona l'inventari d'immobles de l'agència i les seves unitats llogables (pisos, locals, places de garatge, etc.).

**Entitats principals:** `Propietat`, `Unitat`, `Caracteristica`, `Document`

**Funcionalitats:**
- El gestor pot donar d'alta una propietat (edifici, casa, local) amb adreça i dades cadastrals.
- El gestor pot afegir una o més unitats a una propietat (ex: un edifici amb diversos pisos).
- El gestor pot registrar característiques d'una unitat (m², habitacions, banys, moblat, eficiència energètica).
- El gestor pot adjuntar documents a una propietat o unitat (cèdula d'habitabilitat, certificat energètic, escriptures).
- El gestor pot marcar una unitat com a disponible, ocupada o en manteniment.
- El gestor pot consultar l'historial de contractes associats a una unitat.
- El comptable pot consultar (només lectura) el llistat de propietats i unitats.

**Restriccions:**
- Una unitat sempre pertany a una única propietat.
- No es pot eliminar una propietat que tingui unitats amb contractes actius.
- L'estat "ocupada" d'una unitat es deriva automàticament de l'existència d'un contracte actiu (no editable manualment quan hi ha contracte viu).

**Estats possibles:**
- `Unitat`: disponible → ocupada → en manteniment → disponible

**Integracions:** una `Unitat` és l'objecte sobre el qual es formalitza un `Contracte` (mòdul 3.5); els documents comparteixen model amb Propietaris i Inquilins.

---

### 3.3 Propietaris

**Descripció breu:** gestiona les dades de les persones (físiques o jurídiques) titulars de les propietats gestionades per l'agència.

**Entitats principals:** `Propietari`, `Document`

**Funcionalitats:**
- El gestor pot donar d'alta un propietari com a persona física (DNI/NIE) o jurídica (CIF, raó social, representant legal).
- El gestor pot associar una o més propietats a un propietari.
- El gestor pot adjuntar documents identificatius (DNI, escriptures, poders de representació).
- El gestor pot consultar l'historial de rendes generades per un propietari en un període.
- El comptable pot consultar (només lectura) les dades del propietari per liquidar rendes.

**Restriccions:**
- Una propietat pot tenir més d'un propietari (copropietat), amb percentatge de titularitat que ha de sumar 100%.
- No es pot eliminar un propietari amb propietats actives associades.
- El NIF/CIF ha de ser únic dins del tenant.

**Estats possibles:**
- `Propietari`: actiu → inactiu (baixa, sense propietats associades)

**Integracions:** vinculat a Propietats (3.2); les seves dades apareixen als informes de liquidació (3.8).

---

### 3.4 Inquilins

**Descripció breu:** gestiona el registre de persones que llogen una unitat, el seu historial i la documentació associada.

**Entitats principals:** `Inquili`, `Document`, `HistorialMora`

**Funcionalitats:**
- El gestor pot donar d'alta un inquilí amb dades personals i de contacte.
- El gestor pot adjuntar documents (DNI/NIE, nòmines, avals, informes de solvència).
- El gestor pot consultar l'historial de contractes d'un inquilí (contractes passats i actuals).
- El gestor pot consultar l'estat de mora actual de l'inquilí.
- El sistema pot marcar automàticament un inquilí en estat de mora quan es compleix la regla de negoci corresponent (secció 5).
- El llogater (portal) pot consultar i actualitzar les seves pròpies dades de contacte.

**Restriccions:**
- No es pot eliminar un inquilí amb un contracte actiu.
- Un inquilí pot tenir diversos contractes **actius simultàniament**, sempre que cadascun sigui sobre una unitat diferent (ex: el mateix inquilí pot tenir alhora un contracte actiu per a un pis, un altre per a una plaça de parking i un altre per a un local). La restricció d'unicitat de contracte actiu s'aplica a la **unitat**, no a l'inquilí (regla compartida amb 3.5).
- Les dades personals de l'inquilí estan subjectes a RGPD (dret d'oblit, secció 4).

**Estats possibles:**
- `Inquili`: actiu → moros → actiu (en regularitzar el deute) → inactiu (sense contractes vigents)

**Integracions:** un `Inquili` és part del `Contracte` (3.5); l'estat de mora es calcula a partir de `Pagaments` (3.6).

---

### 3.5 Contractes

**Descripció breu:** gestiona el cicle de vida complet dels contractes de lloguer entre propietari(s), inquilí(s) i una unitat.

**Entitats principals:** `Contracte`, `Fiança`, `ClausulaAddicional`, `IndexActualitzacio`

**Funcionalitats:**
- El gestor pot crear un contracte associant una unitat, un o més inquilins i un o més propietaris.
- El gestor pot definir el tipus d'ús del contracte (habitatge, local, parking, industrial, altres), que determina els límits de fiança aplicables.
- El gestor pot definir la renda mensual, la durada, la data d'inici i l'índex d'actualització (IPC o índex pactat).
- El gestor pot registrar l'import de la fiança dipositada.
- El gestor pot renovar un contracte (pròrroga) abans del venciment.
- El gestor pot resoldre un contracte anticipadament, indicant motiu i data efectiva.
- El sistema pot actualitzar automàticament la renda en la data d'aniversari segons l'índex configurat.
- El gestor pot generar el document PDF del contracte a partir de les dades introduïdes.
- El comptable pot consultar (només lectura) les condicions econòmiques d'un contracte.

**Restriccions:**
- Una unitat només pot tenir un contracte en estat `actiu` simultàniament (un mateix inquilí sí que pot tenir diversos contractes actius, un per unitat diferent — vegeu 3.4).
- Els límits de fiança depenen del tipus d'ús del contracte: als contractes d'**habitatge**, la fiança mínima és una mensualitat de renda i la màxima, dues; als contractes d'**altres usos** (local, parking, industrial, etc.) els límits es pacten lliurement entre les parts i poden diferir dels d'habitatge (el sistema no aplica el topall de dues mensualitats en aquests casos, però permet configurar un mínim/màxim propi per tipus d'ús a nivell de tenant).
- No es pot activar un contracte si la unitat ja té un altre contracte actiu.
- La resolució d'un contracte allibera la unitat (torna a `disponible`) i tanca l'estat de mora associat si no hi ha deute pendent.

**Estats possibles:**
- `Contracte`: esborrany → actiu → finalitzat → resolt

**Integracions:** en crear-se un contracte `actiu`, la `Unitat` (3.2) passa a `ocupada`; genera el calendari de `Pagaments` (3.6); l'`Inquili` (3.4) queda vinculat mentre el contracte estigui viu.

---

### 3.6 Pagaments

**Descripció breu:** gestiona els rebuts periòdics de renda, les remeses de cobrament i el seguiment de la morositat.

**Entitats principals:** `Rebut`, `Remesa`, `Liquidacio`

**Funcionalitats:**
- El sistema pot generar automàticament els rebuts mensuals a partir dels contractes actius.
- El comptable pot marcar un rebut com a cobrat, indicant data i mitjà de pagament.
- El comptable pot agrupar rebuts en una remesa per a la seva gestió conjunta.
- El comptable pot generar la liquidació d'un propietari per a un període (rendes cobrades menys despeses/comissió d'agència).
- El sistema pot marcar un rebut com a vençut quan supera la data límit de pagament sense estar cobrat.
- El sistema pot activar l'estat de mora de l'inquilí quan un rebut porta més de 30 dies vençut (regla de negoci, secció 5).
- El comptable pot exportar el llistat de rebuts i liquidacions en CSV i PDF.

**Restriccions:**
- Un rebut sempre està vinculat a un contracte actiu (o finalitzat, per a rebuts pendents de tancament).
- No es pot eliminar un rebut ja cobrat; només es pot anul·lar amb registre d'auditoria.
- L'import del rebut ha de coincidir amb la renda vigent del contracte en el moment de la seva generació.

**Estats possibles:**
- `Rebut`: pendent → cobrat / vençut → mora (si supera 30 dies vençut) → regularitzat

**Integracions:** consumeix la renda vigent del `Contracte` (3.5); alimenta l'estat de mora de l'`Inquili` (3.4); és font principal dels `Informes` (3.8).

---

### 3.7 Incidències

**Descripció breu:** gestiona les incidències reportades sobre una unitat o contracte (avaries, reparacions, queixes) i el seu seguiment fins a la resolució.

**Entitats principals:** `Incidencia`, `Comentari`, `Adjunt`

**Funcionalitats:**
- El gestor pot crear una incidència associada a una unitat i, opcionalment, a un contracte.
- El llogater (portal) pot crear una incidència sobre la seva unitat llogada.
- El gestor pot assignar una incidència a un responsable (intern o proveïdor extern).
- El gestor o el llogater poden afegir comentaris i adjunts de seguiment a una incidència.
- El gestor pot registrar el cost associat a la resolució d'una incidència.
- El gestor pot marcar una incidència com a resoluda.
- El comptable pot consultar (només lectura) el cost de les incidències per repercutir-lo, si escau, a la liquidació del propietari.

**Restriccions:**
- Una incidència només es tanca quan el gestor la marca explícitament com a resolta; el sistema no la tanca automàticament.
- El llogater només pot veure i comentar les incidències que ell mateix ha creat.
- No es pot reobrir una incidència resolta; cal crear-ne una de nova referenciant l'anterior si el problema persisteix.

**Estats possibles:**
- `Incidencia`: oberta → assignada → en curs → resolta

**Integracions:** vinculada a `Unitat` (3.2) i opcionalment a `Contracte` (3.5); el cost pot repercutir a `Informes` (3.8) i a la liquidació de propietari (3.6).

---

### 3.8 Informes & Dashboard

**Descripció breu:** ofereix una vista analítica agregada de l'activitat del tenant i permet l'exportació de dades per a anàlisi externa.

**Entitats principals:** `Indicador`, `InformeExportat`

**Funcionalitats:**
- L'administrador i el comptable poden consultar un dashboard amb indicadors clau: ocupació, morositat, ingressos previstos vs. cobrats, incidències obertes.
- El gestor pot consultar (només lectura) indicadors operatius del seu àmbit.
- Qualsevol usuari amb accés al mòdul pot filtrar els indicadors per rang de dates, propietat o propietari.
- L'usuari pot exportar qualsevol llistat (propietats, contractes, rebuts, incidències) en format CSV i PDF.
- El sistema pot generar un informe de liquidació mensual per propietari.

**Restriccions:**
- Els informes respecten sempre els permisos del mòdul d'origen (ex: el gestor no veu detalls econòmics de liquidació de propietari als informes si no en té accés).
- Les exportacions no poden incloure dades d'un altre tenant sota cap circumstància.

**Estats possibles:** no aplica (mòdul de consulta/agregació, sense cicle de vida propi).

**Integracions:** agrega dades de tots els mòduls anteriors (3.2 a 3.7).

---

### 3.9 Portal del llogater [fase final]

**Descripció breu:** espai extern d'autoservei perquè l'inquilí consulti el seu contracte, rebuts i gestioni les seves incidències, sense necessitat d'intervenció del gestor.

**Entitats principals:** `AccesLlogater`, `Notificacio`

**Funcionalitats:**
- El gestor pot activar l'accés al portal per a un inquilí, generant una invitació per email.
- El llogater pot iniciar sessió amb credencials pròpies (separades dels usuaris interns del tenant).
- El llogater pot consultar el seu contracte actiu i l'històric de contractes propis.
- El llogater pot consultar l'estat i historial dels seus rebuts.
- El llogater pot crear i fer seguiment de les seves pròpies incidències.
- El llogater pot descarregar còpia en PDF del seu contracte i dels seus rebuts.
- El sistema pot notificar el llogater (email) davant de nous rebuts vençuts o respostes a incidències.

**Restriccions:**
- L'accés del llogater es revoca automàticament en resoldre's o finalitzar-se el seu contracte (manté només lectura de l'històric, sense noves accions).
- El llogater mai té visibilitat sobre dades d'altres inquilins, propietaris o informació econòmica interna de l'agència.
- L'autenticació del portal és independent de la dels usuaris interns però comparteix el mateix mecanisme JWT amb un `rol` diferenciat.

**Estats possibles:**
- `AccesLlogater`: convidat → actiu → revocat

**Integracions:** consumeix dades en només lectura/creació limitada de `Contractes` (3.5), `Pagaments` (3.6) i `Incidències` (3.7); depèn d'Auth & Multitenancy (3.1) per a l'autenticació.

---

## 4. Requisits no funcionals

- **Rendiment:** temps de resposta inferior a 500ms per a llistats paginats en condicions normals de càrrega.
- **Seguretat d'autenticació:** JWT amb expiració configurable per tenant; contrasenyes amb hash `bcryptjs`; bloqueig temporal després d'intents fallits repetits.
- **Exportació:** tots els llistats principals (propietats, propietaris, inquilins, contractes, rebuts, incidències) han de poder exportar-se en CSV i PDF.
- **Auditoria:** totes les modificacions sobre dades han de registrar usuari, timestamp i valor anterior (log d'auditoria immutable).
- **RGPD:** dret d'oblit implementable per a dades d'inquilins (anonimització o eliminació controlada, mantenint la integritat dels registres econòmics/legals obligatoris).
- **Multitenancy i aïllament:** cap consulta pot retornar dades d'un tenant diferent de l'usuari autenticat, ni tan sols per error de programació (validació obligatòria a nivell de query, no només d'UI).
- **Disponibilitat:** l'aplicació ha d'estar operativa en horari laboral amb un objectiu de disponibilitat del 99.5%.
- **Accessibilitat:** interfície usable amb teclat i compatible amb lectors de pantalla per a les pantalles crítiques (login, llistats, formularis de contracte i pagament).
- **Internacionalització:** l'aplicació es desenvolupa en català com a idioma base, amb estructura preparada per afegir castellà/anglès en el futur (no requerit en aquesta fase).
- **Compatibilitat:** navegadors moderns (Chrome, Edge, Firefox, Safari) en les seves dues últimes versions majors.

---

## 5. Regles de negoci crítiques

1. **Una propietat pot tenir múltiples unitats.** Ex: un edifici de 6 pisos es dona d'alta com una `Propietat` amb 6 `Unitat` independents, cadascuna amb el seu propi contracte i estat d'ocupació.

2. **Una unitat només pot tenir un contracte actiu simultàniament; un inquilí, en canvi, pot tenir diversos contractes actius alhora si són sobre unitats diferents.** Ex: si la unitat "Pis 2n 1a" té un contracte `actiu` amb l'inquilí A, no es pot activar un segon contracte per a la mateixa unitat fins que el primer passi a `finalitzat` o `resolt`; però l'inquilí A pot tenir simultàniament un altre contracte `actiu` per a una plaça de parking o un local diferents.

3. **La renda s'actualitza anualment per IPC (o índex pactat al contracte).** Ex: un contracte amb data d'inici 1 de març i índex IPC actualitza automàticament la renda cada 1 de març segons la variació interanual de l'IPC publicada.

4. **La fiança mínima i màxima depenen del tipus d'ús del contracte.** Ex: per a un contracte d'**habitatge** amb renda de 800€/mes, la fiança vàlida ha d'estar entre 800€ i 1.600€ (una a dues mensualitats); el sistema rebutja valors fora d'aquest rang. Per a un contracte de **local comercial** o **parking**, els límits no venen fixats per aquesta regla i es configuren segons el que pactin les parts (ex: dues mensualitats mínimes sense topall màxim, habitual en lloguer d'ús diferent d'habitatge).

5. **Un pagament vençut > 30 dies activa l'estat de mora a l'inquilí.** Ex: si el rebut de gener (venciment 5 de gener) no consta com a cobrat el 4 de febrer, l'inquilí passa automàticament a l'estat `moros`, visible al seu perfil i als informes.

6. **Les incidències es tanquen només quan el gestor les marca com a resoltes.** Ex: encara que el proveïdor extern confirmi la reparació, la incidència roman `en curs` fins que el gestor revisi i marqui manualment l'estat `resolta`.

7. **El multitenancy aïlla completament les dades entre agències.** Ex: un usuari del tenant "Agència Vermell" mai pot veure, editar ni exportar dades del tenant "Agència Blau", ni per error d'UI ni per manipulació directa de paràmetres de petició.

---

## 6. Glossari

| Terme | Definició |
|---|---|
| **Tenant** | Agència o entitat client que utilitza Gestinmo de forma aïllada de la resta; cada tenant té el seu propi esquema de dades. |
| **Multitenancy** | Arquitectura on una única instal·lació de l'aplicació serveix múltiples tenants amb dades completament aïllades. |
| **Propietat** | Immoble (edifici, casa, local) donat d'alta a l'agència, que pot contenir una o més unitats llogables. |
| **Unitat** | Espai llogable individual dins d'una propietat (pis, local, plaça de garatge). |
| **Propietari** | Persona física o jurídica titular d'una o més propietats gestionades per l'agència. |
| **Inquili** | Persona que ocupa una unitat en règim de lloguer mitjançant un contracte. |
| **Contracte** | Acord formal de lloguer entre propietari(s) i inquilí(s) sobre una unitat, amb condicions econòmiques i temporals definides. |
| **Fiança** | Import dipositat per l'inquilí com a garantia, retornable en finalitzar el contracte segons condicions. |
| **Índex d'actualització** | Referència (IPC o un altre pactat) usada per revisar anualment la renda del contracte. |
| **Rebut** | Document que representa el cobrament periòdic (habitualment mensual) de la renda d'un contracte. |
| **Remesa** | Agrupació de rebuts gestionats conjuntament per al seu cobrament. |
| **Liquidació** | Càlcul periòdic dels ingressos nets d'un propietari (rendes cobrades menys despeses i comissió d'agència). |
| **Mora** | Estat de l'inquilí quan té un o més rebuts vençuts sense cobrar durant més de 30 dies. |
| **Incidència** | Registre d'un problema o sol·licitud (avaria, reparació, queixa) associat a una unitat o contracte, amb seguiment fins a la seva resolució. |
| **Portal del llogater** | Espai extern d'accés limitat perquè l'inquilí consulti i gestioni les seves pròpies dades sense intervenció del gestor. |
| **Administrador** | Rol amb accés total a la configuració i dades del tenant. |
| **Gestor** | Rol operatiu amb accés a la gestió diària de propietats, propietaris, inquilins, contractes i incidències. |
| **Comptable** | Rol amb accés centrat en pagaments, morositat i informes econòmics. |
| **Auditoria** | Registre immutable de qui, quan i què s'ha modificat sobre una dada del sistema. |
| **RGPD** | Reglament General de Protecció de Dades; normativa europea que regula el tractament de dades personals, incloent el dret d'oblit. |
| **JWT** | JSON Web Token; mecanisme d'autenticació usat per identificar l'usuari i el seu tenant/rol en cada petició. |

---

## Criteris de completesa (autoverificació)

- [x] Tots els 9 mòduls estan descrits
- [x] Tots els rols tenen la matriu de permisos completa
- [x] Totes les entitats de domini estan nomenades i definides
- [x] Els estats de cada entitat estan enumerats
- [x] Les regles de negoci crítiques estan documentades amb exemples
- [x] El glossari conté tots els termes de domini
