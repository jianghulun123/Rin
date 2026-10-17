ALTER TABLE `feeds` ADD COLUMN `translations` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '13' WHERE `key` = 'migration_version';
