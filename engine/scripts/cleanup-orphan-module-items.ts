// DESTINATION: engine/scripts/cleanup-orphan-module-items.ts
// Run with:  npx ts-node -e "import('./scripts/cleanup-orphan-module-items')"
// Or:        npx tsx scripts/cleanup-orphan-module-items.ts
//
// This script removes module_items where the referenced entity (material/assignment/quiz)
// no longer exists or has been soft-deleted. Safe to run at any time — read-only pass first.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[cleanup] Starting orphan module_items scan (dry-run: ${dryRun})`);

  const items = await prisma.moduleItem.findMany({
    select: { id: true, type: true, refId: true, moduleId: true },
  });

  console.log(`[cleanup] Total module items to check: ${items.length}`);

  const orphanIds: number[] = [];

  for (const item of items) {
    let exists = false;
    try {
      if (item.type === "material") {
        const ref = await prisma.courseMaterial.findUnique({ where: { id: item.refId } });
        exists = !!ref;
      } else if (item.type === "assignment") {
        const ref = await prisma.assignment.findUnique({ where: { id: item.refId } });
        exists = !!ref && ref.isActive;
      } else if (item.type === "quiz") {
        const ref = await prisma.quiz.findUnique({ where: { id: item.refId } });
        exists = !!ref && ref.isActive;
      }
    } catch {
      exists = false;
    }

    if (!exists) {
      orphanIds.push(item.id);
      console.log(
        `[cleanup] ORPHAN → moduleItem #${item.id} (type=${item.type}, refId=${item.refId}, moduleId=${item.moduleId})`
      );
    }
  }

  console.log(`[cleanup] Found ${orphanIds.length} orphan item(s).`);

  if (orphanIds.length === 0) {
    console.log("[cleanup] Nothing to delete. Done.");
    return;
  }

  if (dryRun) {
    console.log("[cleanup] DRY RUN — no records deleted. Re-run without --dry-run to apply.");
    return;
  }

  const { count } = await prisma.moduleItem.deleteMany({
    where: { id: { in: orphanIds } },
  });
  console.log(`[cleanup] Deleted ${count} orphan module_item(s). Done.`);
}

main()
  .catch(e => { console.error("[cleanup] Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());