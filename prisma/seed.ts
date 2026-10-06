import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const MIN_PASSWORD_LENGTH = 8

async function main() {
  const username = process.env.SEED_USERNAME?.trim()
  const password = process.env.SEED_PASSWORD
  const force = process.argv.includes("--force")

  if (!username || !password) {
    console.log("Seed omitido: define SEED_USERNAME y SEED_PASSWORD")
    return
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.log(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
    )
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { username } })

  if (existing) {
    if (!force) {
      console.log(`El usuario "${username}" ya existe.`)
      console.log("Usa --force para actualizar su contraseña:")
      console.log("  npm run db:seed -- --force")
      return
    }

    await prisma.user.update({
      where: { username },
      data: { password: await bcrypt.hash(password, 10) },
    })

    console.log(`Contraseña actualizada para "${username}"`)
    return
  }

  await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      role: "mod",
    },
  })

  console.log(`Usuario creado: ${username}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })