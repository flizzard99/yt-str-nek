#!/usr/bin/env node
/**
 * Build con migraciones aplicadas en Vercel.
 *
 * Sin esto, el orden importa y hay que acordarse: si se despliega código que
 * usa una columna nueva antes de aplicar la migración, la web se cae con
 * errores de Prisma (P2022) en TODO lo que toque la tabla, incluido el login.
 *
 * Solo se aplican en Vercel. En local, migrar en cada build sería una
 * sorpresa y haría fallar el build con la base apagada: ahí se usa
 * `npx prisma migrate deploy` a mano, o `npm run db:migrate`.
 */
import { spawnSync } from "node:child_process"

const isVercel = Boolean(process.env.VERCEL)

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  })

  if (result.status !== 0) {
    if (isVercel && command === "prisma") {
      console.error(
        "\nNo se pudieron aplicar las migraciones. Se corta el despliegue para no " +
          "publicar código que no encaja con la base de datos.\n"
      )
    }
    process.exit(result.status ?? 1)
  }
}

if (isVercel) {
  console.log("==> Aplicando migraciones antes de compilar")
  run("npx", ["prisma", "migrate", "deploy"])
}

run("npx", ["next", "build"])