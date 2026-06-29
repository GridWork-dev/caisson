CREATE TABLE feature_flag (
  id uuid PRIMARY KEY,
  widget_id uuid NOT NULL REFERENCES widget(id),
  enabled boolean NOT NULL DEFAULT false
);
