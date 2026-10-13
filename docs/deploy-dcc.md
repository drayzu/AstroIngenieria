# Despliegue al DCC

Configuración inicial en este computador:

```powershell
npm run setup:dcc
```

El comando crea una llave Ed25519 dedicada en
`~/.ssh/astroingenieria-dcc-deploy`, sin frase de paso para permitir despliegues
automáticos. Pide la contraseña del DCC una vez para agregar la llave pública a
`~/.ssh/authorized_keys`. Conserva las otras llaves autorizadas. La llave privada
permanece en este computador, fuera del proyecto y de Git, y debe mantenerse privada.

Verificar el acceso sin publicar ni modificar el sitio:

```powershell
npm run check:dcc
```

Publicar:

```powershell
npm run deploy:dcc
```

El script usa la llave para SSH y SCP. Si la autenticación falla, termina antes
de compilar o tocar el servidor. Publica el nuevo build en `public_www` y borra
la versión anterior, siguiendo el procedimiento original y sin acumular respaldos.

Para elegir otra llave, establece `DCC_SSH_KEY` con su ruta antes de ejecutar
estos comandos. Las llaves cifradas necesitan estar cargadas en `ssh-agent`.

La llave dedicada se registra con `restrict`: permite ejecutar el despliegue y
transferir archivos, y desactiva el reenvío de conexiones y terminales interactivos.

Referencia: [llaves SSH del DCC](https://sistemas.dcc.uchile.cl/#agregar-mi-llave-ssh).
