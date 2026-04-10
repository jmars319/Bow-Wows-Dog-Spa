INSERT INTO site_settings (`key`, `value`)
VALUES
    ('business_name', 'Bow Wow''s Dog Spa'),
    ('serving_area', 'Proudly serving Greater Winston-Salem and the Triad area'),
    ('address', '11141 Old U.S. Hwy 52 #4, Winston-Salem, NC 27107'),
    ('phone', '(336) 842-3723'),
    ('email', 'bowwowsdogspa@gmail.com'),
    ('hours', 'Mon-Thurs 10a-5p · Fri, Sat by special appointment')
ON DUPLICATE KEY UPDATE
    `value` = IF(TRIM(COALESCE(`value`, '')) = '', VALUES(`value`), `value`);
