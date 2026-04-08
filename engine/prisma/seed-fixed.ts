import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AdvaTech LMS...\n");
  
  const passwordHash = await bcrypt.hash("ChangeMe@2025!", 10);
  
  // 1. Create Institution
  console.log("📚 Creating institution...");
  const institution = await prisma.institution.upsert({
    where: { slug: "tuk" },
    update: {},
    create: {
      name: "Technical University of Kenya",
      slug: "tuk",
      is_active: true,
    },
  });
  console.log(`✅ Institution: ${institution.name} (ID: ${institution.id})`);
  
  // 2. Create Roles (using uppercase names to match existing schema)
  console.log("👥 Creating roles...");
  const roles = {
    platform_admin: await prisma.role.upsert({
      where: { name: "PLATFORM_ADMIN" },
      update: {},
      create: { name: "PLATFORM_ADMIN" },
    }),
    institution_admin: await prisma.role.upsert({
      where: { name: "INSTITUTION_ADMIN" },
      update: {},
      create: { name: "INSTITUTION_ADMIN" },
    }),
    lecturer: await prisma.role.upsert({
      where: { name: "LECTURER" },
      update: {},
      create: { name: "LECTURER" },
    }),
    student: await prisma.role.upsert({
      where: { name: "STUDENT" },
      update: {},
      create: { name: "STUDENT" },
    }),
  };
  console.log("✅ Roles created");
  
  // 3. Create Users
  console.log("👤 Creating users...");
  
  const platformAdmin = await prisma.user.upsert({
    where: { email: "platform@advatech.ke" },
    update: {},
    create: {
      email: "platform@advatech.ke",
      password_hash: passwordHash,
      name: "Platform Administrator",
      is_active: true,
      email_verified: true,
    },
  });
  
  const institutionAdmin = await prisma.user.upsert({
    where: { email: "admin@tuk.ac.ke" },
    update: {},
    create: {
      email: "admin@tuk.ac.ke",
      password_hash: passwordHash,
      name: "Dr. James Odhiambo",
      institution_id: institution.id,
      is_active: true,
      email_verified: true,
    },
  });
  
  const lecturer = await prisma.user.upsert({
    where: { email: "lecturer@tuk.ac.ke" },
    update: {},
    create: {
      email: "lecturer@tuk.ac.ke",
      password_hash: passwordHash,
      name: "Dr. Jane Mwangi",
      institution_id: institution.id,
      is_active: true,
      email_verified: true,
    },
  });
  
  const student = await prisma.user.upsert({
    where: { email: "student@tuk.ac.ke" },
    update: {},
    create: {
      email: "student@tuk.ac.ke",
      password_hash: passwordHash,
      name: "Alice Kamau",
      institution_id: institution.id,
      is_active: true,
      email_verified: true,
    },
  });
  
  console.log("✅ Users created");
  
  // 4. Assign Roles
  console.log("🔑 Assigning roles...");
  
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: platformAdmin.id,
        role_id: roles.platform_admin.id,
      },
    },
    update: {},
    create: {
      user_id: platformAdmin.id,
      role_id: roles.platform_admin.id,
    },
  });
  
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: institutionAdmin.id,
        role_id: roles.institution_admin.id,
      },
    },
    update: {},
    create: {
      user_id: institutionAdmin.id,
      role_id: roles.institution_admin.id,
      institution_id: institution.id,
    },
  });
  
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: lecturer.id,
        role_id: roles.lecturer.id,
      },
    },
    update: {},
    create: {
      user_id: lecturer.id,
      role_id: roles.lecturer.id,
      institution_id: institution.id,
    },
  });
  
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: student.id,
        role_id: roles.student.id,
      },
    },
    update: {},
    create: {
      user_id: student.id,
      role_id: roles.student.id,
      institution_id: institution.id,
    },
  });
  
  console.log("✅ Roles assigned");
  
  // 5. Create Lecturer Profile
  console.log("👨‍🏫 Creating lecturer profile...");
  await prisma.lecturerProfile.upsert({
    where: { user_id: lecturer.id },
    update: {},
    create: {
      user_id: lecturer.id,
      employee_id: "LEC001",
      institution_id: institution.id,
      is_active: true,
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
