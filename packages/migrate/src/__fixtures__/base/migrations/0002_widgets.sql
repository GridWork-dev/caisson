CREATE TABLE widget (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
