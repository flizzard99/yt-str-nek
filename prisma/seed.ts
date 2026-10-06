import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const username = process.env.SEED_USERNAME
  const password = process.env.SEED_PASSWORD

  if (!username || !password) {
    console.log("Skipping seed: SEED_USERNAME and SEED_PASSWORD not set")
    return
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  })

  if (existingUser) {
    console.log(`User ${username} already exists`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: "mod",
    },
  })

  console.log(`Created user: ${username}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
