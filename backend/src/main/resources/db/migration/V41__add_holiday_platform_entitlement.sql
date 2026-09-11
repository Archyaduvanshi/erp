insert into subscription_plan_features(plan_id, feature_code)
select id, 'HOLIDAYS' from subscription_plans
on conflict do nothing;
