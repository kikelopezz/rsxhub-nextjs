-- CreateIndex
CREATE INDEX "league_events_league_id_starts_at_idx" ON "league_events"("league_id", "starts_at");

-- CreateIndex
CREATE INDEX "league_members_user_id_idx" ON "league_members"("user_id");

-- CreateIndex
CREATE INDEX "league_registrations_league_id_idx" ON "league_registrations"("league_id");

-- CreateIndex
CREATE INDEX "league_registrations_user_id_idx" ON "league_registrations"("user_id");

-- CreateIndex
CREATE INDEX "league_registrations_team_id_idx" ON "league_registrations"("team_id");

-- CreateIndex
CREATE INDEX "league_team_registrations_team_id_idx" ON "league_team_registrations"("team_id");

-- CreateIndex
CREATE INDEX "league_event_confirmations_league_id_idx" ON "league_event_confirmations"("league_id");

-- CreateIndex
CREATE INDEX "league_event_confirmations_team_id_idx" ON "league_event_confirmations"("team_id");

-- CreateIndex
CREATE INDEX "league_results_event_id_session_type_idx" ON "league_results"("event_id", "session_type");

-- CreateIndex
CREATE INDEX "league_results_league_id_idx" ON "league_results"("league_id");

-- CreateIndex
CREATE INDEX "league_results_user_id_idx" ON "league_results"("user_id");

-- CreateIndex
CREATE INDEX "team_cars_team_id_idx" ON "team_cars"("team_id");

-- CreateIndex
CREATE INDEX "team_car_league_drivers_user_id_idx" ON "team_car_league_drivers"("user_id");

-- CreateIndex
CREATE INDEX "team_skin_assignments_team_id_idx" ON "team_skin_assignments"("team_id");

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_invites_team_id_idx" ON "team_invites"("team_id");

-- CreateIndex
CREATE INDEX "team_invites_invited_user_id_idx" ON "team_invites"("invited_user_id");

-- CreateIndex
CREATE INDEX "market_listings_created_at_idx" ON "market_listings"("created_at");

-- CreateIndex
CREATE INDEX "market_listings_user_id_idx" ON "market_listings"("user_id");

-- CreateIndex
CREATE INDEX "market_listings_team_id_idx" ON "market_listings"("team_id");

-- CreateIndex
CREATE INDEX "market_applications_listing_id_idx" ON "market_applications"("listing_id");

-- CreateIndex
CREATE INDEX "market_applications_user_id_idx" ON "market_applications"("user_id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "calendar_notes_date_idx" ON "calendar_notes"("date");

-- CreateIndex
CREATE INDEX "news_posts_published_at_idx" ON "news_posts"("published_at");

