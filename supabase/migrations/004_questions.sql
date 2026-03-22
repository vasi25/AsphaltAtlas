-- ============================================================
-- QUESTIONS — users can ask questions about a route
-- ============================================================
CREATE TABLE questions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id   UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_route_id ON questions(route_id);

-- ============================================================
-- QUESTION ANSWERS — replies to a question
-- ============================================================
CREATE TABLE question_answers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_question_answers_question_id ON question_answers(question_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

-- questions
CREATE POLICY "Questions are viewable by everyone"
    ON questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post questions"
    ON questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own questions"
    ON questions FOR DELETE USING (auth.uid() = user_id);

-- question_answers
CREATE POLICY "Answers are viewable by everyone"
    ON question_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post answers"
    ON question_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own answers"
    ON question_answers FOR DELETE USING (auth.uid() = user_id);
