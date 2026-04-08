import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...\n");
  
  // Check if users already exist
  const existingUsers = await prisma.user.findMany({
    where: {
      email: {
        in: ["admin@tuk.ac.ke", "lecturer@tuk.ac.ke", "student@tuk.ac.ke", "platform@advatech.ke"]
      }
    }
  });
  
  if (existingUsers.length > 0) {
    console.log(`✅ Users already exist (${existingUsers.length} found). No seeding needed.`);
    console.log("\nExisting users:");
    existingUsers.forEach(u => {
      console.log(`   - ${u.email} (${u.name})`);
    });
    return;
  }
  
  // Get or create institution
  console.log("📚 Setting up institution...");
  let institution = await prisma.institution.findFirst({
    where: { slug: "tuk" }
  });
  
  if (!institution) {
    institution = await prisma.institution.create({
      data: {
        name: "Technical University of Kenya",
        slug: "tuk",
        isActive: true,
      },
    });
    console.log(`✅ Created institution: ${institution.name} (ID: ${institution.id})`);
  } else {
    console.log(`✅ Using existing institution: ${institution.name} (ID: ${institution.id})`);
  }
  
  // Get roles
  console.log("\n👥 Fetching roles...");
  const platformRole = await prisma.role.findFirst({ where: { name: "PLATFORM_ADMIN" } });
  const adminRole = await prisma.role.findFirst({ where: { name: "INSTITUTION_ADMIN" } });
  const lecturerRole = await prisma.role.findFirst({ where: { name: "LECTURER" } });
  const studentRole = await prisma.role.findFirst({ where: { name: "STUDENT" } });
  
  if (!platformRole || !adminRole || !lecturerRole || !studentRole) {
    console.error("❌ Roles not found. Please run migrations first.");
    console.log("Run: npx prisma migrate deploy");
    process.exit(1);
  }
  
  console.log("✅ Roles found");
  
  // Password hash for "ChangeMe@2025!"
  const passwordHash = "$2b$10$Ic0VFYfpm3tTcB3STKG7XeDX2e8MZuy3qIaX4amd3dDtZLsrvK2IW";
  
  // Create users
  console.log("\n👤 Creating users...");
  
  const platformAdmin = await prisma.user.create({
    data: {
      email: "platform@advatech.ke",
      passwordHash: passwordHash,
      name: "Platform Administrator",
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created: ${platformAdmin.email}`);
  
  const institutionAdmin = await prisma.user.create({
    data: {
      email: "admin@tuk.ac.ke",
      passwordHash: passwordHash,
      name: "Dr. James Odhiambo",
      institutionId: institution.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created: ${institutionAdmin.email}`);
  
  const lecturer = await prisma.user.create({
    data: {
      email: "lecturer@tuk.ac.ke",
      passwordHash: passwordHash,
      name: "Dr. Jane Mwangi",
      institutionId: institution.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created: ${lecturer.email}`);
  
  const student = await prisma.user.create({
    data: {
      email: "student@tuk.ac.ke",
      passwordHash: passwordHash,
      name: "Alice Kamau",
      institutionId: institution.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created: ${student.email}`);
  
  // Assign roles
  console.log("\n🔑 Assigning roles...");
  
  await prisma.userRole.create({
    data: {
      userId: platformAdmin.id,
      roleId: platformRole.id,
    },
  });
  console.log(`✅ Assigned ${platformRole.name} to ${platformAdmin.email}`);
  
  await prisma.userRole.create({
    data: {
      userId: institutionAdmin.id,
      roleId: adminRole.id,
      institutionId: institution.id,
    },
  });
  console.log(`✅ Assigned ${adminRole.name} to ${institutionAdmin.email}`);
  
  await prisma.userRole.create({
    data: {
      userId: lecturer.id,
      roleId: lecturerRole.id,
      institutionId: institution.id,
    },
  });
  console.log(`✅ Assigned ${lecturerRole.name} to ${lecturer.email}`);
  
  await prisma.userRole.create({
    data: {
      userId: student.id,
      roleId: studentRole.id,
      institutionId: institution.id,
    },
  });
  console.log(`✅ Assigned ${studentRole.name} to ${student.email}`);
  
  // Create lecturer profile
  console.log("\n👨‍🏫 Creating lecturer profile...");
  await prisma.lecturerProfile.create({
    data: {
      userId: lecturer.id,
      employeeId: "LEC001",
      institutionId: institution.id,
      isActive: true,
    },
  });
  console.log("✅ Lecturer profile created");
  
  console.log("\n🎉 Seeding completed successfully!");
  console.log("\n📝 Login credentials (password for all: ChangeMe@2025!):");
  console.log("   Platform Admin: platform@advatech.ke");
  console.log("   Institution Admin: admin@tuk.ac.ke");
  console.log("   Lecturer: lecturer@tuk.ac.ke");
  console.log("   Student: student@tuk.ac.ke");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
