-- ============================================================
-- AdvaTech LMS — Add Module/Lesson/Progress System
-- Run: psql $DATABASE_URL < this_file.sql
--   OR: copy into a new Prisma migration file
-- ============================================================

-- 1. course_modules — ordered sections within a course
CREATE TABLE IF NOT EXISTS course_modules (
  id             SERIAL PRIMARY KEY,
  course_id      INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_published   BOOLEAN NOT NULL DEFAULT false,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_institution ON course_modules(institution_id);

-- 2. module_items — ordered items inside a module
--    type: 'material' | 'assignment' | 'quiz'
--    ref_id: foreign key to the relevant table
CREATE TABLE IF NOT EXISTS module_items (
  id             SERIAL PRIMARY KEY,
  module_id      INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  type           VARCHAR(20) NOT NULL CHECK (type IN ('material', 'assignment', 'quiz')),
  ref_id         INTEGER NOT NULL,  -- FK to course_materials.id / assignments.id / quizzes.id
  title          VARCHAR(255),      -- override title (optional, falls back to ref title)
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_locked      BOOLEAN NOT NULL DEFAULT false,
  unlock_date    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_module_items_module ON module_items(module_id);

-- 3. student_progress — tracks what a student has viewed/completed
CREATE TABLE IF NOT EXISTS student_progress (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES users(id),
  course_id       INTEGER NOT NULL REFERENCES courses(id),
  item_type       VARCHAR(20) NOT NULL, -- 'material' | 'assignment' | 'quiz'
  item_id         INTEGER NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'viewed', -- 'viewed' | 'completed'
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  institution_id  INTEGER NOT NULL REFERENCES institutions(id),
  UNIQUE(student_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_student_course ON student_progress(student_id, course_id);

-- 4. Add endsAt to quiz_attempts (for timer enforcement)
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
