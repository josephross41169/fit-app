-- Migration: Add nutrition_goals column to users table
-- Run this in Supabase SQL Editor

-- Add nutrition_goals jsonb column to users
alter table users add column if not exists nutrition_goals jsonb;
-- Example value: { "calories": 2500, "protein": 180, "carbs": 250, "fat": 70, "water_oz": 100 }

-- Also ensure food_items column supports extended macro data
-- The food_items column is already jsonb, so it will accept the new shape:
-- [{ name, calories, protein, carbs, fat, servingSize, qty }]
