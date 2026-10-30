# ListPro UserWeb

Panel de administración de las cuentas de **ListPro**: usuarios, planes, invitaciones y SMTP.

No guarda usuarios: los lee y modifica en ListPro a través de su API de administración.
La contraseña SMTP se guarda cifrada en ListPro y **este panel nunca la recibe en claro**.

## Qué hace

- Login de administrador con la cuenta definida en Coolify.
- **Resumen**: usuarios, activos en 7 y 30 días, altas de los últimos 30 días, listas compartidas,
  invitaciones, estado del correo y de los catálogos de cada súper (con botón para actualizarlos).
- Listado y búsqueda de usuarios, con su última actividad (en el móvil se ve como tarjetas).
- Ficha de usuario: quién le invitó, a quién ha invitado y su lista (miembros, productos, compras).
- Cambiar plan **Pro / Estándar**.
- Regenerar la invitación de un usuario.
- Enviar el correo de restablecimiento de contraseña.
- Cerrar todas las sesiones de un usuario y borrar su cuenta (hay que escribir su email para confirmar).
- Aviso arriba si el panel no llega a ListPro o si el token no coincide.
- Ajustes:
  - Plan por defecto de los usuarios nuevos: Pro o Estándar.
  - Registro con invitación obligatoria o abierto.
  - SMTP configurable y correo de prueba.
- Auditoría de cambios.

Necesita ListPro con la API de administración al día (la de esta versión añade la ficha completa,
cerrar sesiones, borrar cuentas, `GET /api/admin/smtp` y más datos en las estadísticas). Con un ListPro
antiguo el panel funciona, pero esas partes avisan de que hay que redesplegar ListPro.

## Variables de entorno

```text
LISTPRO_API_URL=https://listpro.xyoncloud.win
LISTPRO_ADMIN_TOKEN=<el mismo ADMIN_TOKEN de ListPro>
PANEL_ADMIN_EMAIL=tu@email.com
PANEL_ADMIN_PASSWORD=<contraseña larga>
PANEL_SESSION_SECRET=<openssl rand -base64 48>
APP_ORIGIN=https://users.listpro.xyoncloud.win
PORT=3000
DB_PATH=/data/panel.db
```

- `PANEL_ADMIN_EMAIL` y `PANEL_ADMIN_PASSWORD` crean/actualizan el administrador en cada arranque.
- `PANEL_SESSION_SECRET` debe ser estable. Si falta, se genera y se guarda en la base del panel.
- `APP_ORIGIN` es el dominio público del panel; se usa para validar el origen de las peticiones.

## Despliegue en Coolify

1. Crea un recurso desde `mkandreum/ListProUserWeb`, rama `main`, Build Pack **Docker Compose**.
2. Rellena las variables de entorno anteriores.
3. Asigna el dominio `users.listpro.xyoncloud.win` al servicio `panel`, puerto **3000**.
4. Deploy.

El volumen `listpro_userweb_data` guarda la base del panel y la auditoría.

En ListPro, `ADMIN_TOKEN` debe ser el mismo que `LISTPRO_ADMIN_TOKEN` del panel.

## SMTP

El panel edita la configuración SMTP guardada en ListPro:

- host, puerto, usuario, contraseña, TLS y remitente.
- La contraseña se cifra con AES-256-GCM en ListPro (`ENCRYPTION_KEY`).
- El panel solo muestra `••••••••`; si se deja así, no se cambia.
- “Probar correo” envía un email de prueba.

Si se pierde `ENCRYPTION_KEY`, hay que volver a escribir la contraseña SMTP.

## Desarrollo local

```bash
cd server && npm install
cd ../web && npm install
```

Terminal 1:

```bash
cd server
LISTPRO_API_URL=http://localhost:3000 \
LISTPRO_ADMIN_TOKEN=dev-token \
PANEL_ADMIN_EMAIL=admin@local \
PANEL_ADMIN_PASSWORD=admin12345 \
PANEL_SESSION_SECRET=dev-secret-dev-secret-dev-secret-1234 \
npm start
```

Terminal 2:

```bash
cd web
npm run dev
```

La web de desarrollo hace proxy de `/api` a `http://localhost:3000` (ver `vite.config.ts`).

## Seguridad

- Cookie `HttpOnly`, `SameSite=Strict`, `Secure` en producción.
- Contraseña con bcrypt 12.
- Rate limit en login.
- Token de ListPro solo en el servidor; nunca llega al navegador.
- Auditoría de cambios de plan, invitaciones, reset y SMTP.
- No expone la contraseña SMTP.
