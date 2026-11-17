-- Starter catalogue. Edit names, prices and stock from /#admin once the site is live.
with p as (
  insert into public.products (name, category, description, price_kes, shape, sort) values
   ('Eye Tee','Apparel','Heavyweight 240 gsm cotton with the UK monogram on the chest and the tagline across the back neck. Cut boxy, pre-washed.',2200,'tee',1),
   ('Beyond Hoodie','Apparel','Brushed-back fleece, double-lined hood, monogram embroidered in white thread. Made to be worn at a dawn walk.',5500,'hoodie',2),
   ('Dusk Cap','Headwear','Unstructured six-panel cotton cap with a tonal strap and a small embroidered eye.',1800,'cap',3),
   ('Field Tote','Bags','Heavy canvas tote with an inside pocket. Holds a camera, a flask and a field guide.',1500,'tote',4),
   ('Campfire Mug','Home','Enamel mug with a steel rim. Light enough to pack, tough enough to leave by the fire.',1300,'mug',5),
   ('Unseen Print, A3','Prints','Giclée print of the Unseen Kenya poster on 250 gsm matt paper. Numbered on the back.',2800,'print',6),
   ('Eye Pin Set','Accessories','Three enamel pins: the eye, the monogram and the Kenya outline.',900,'pin',7),
   ('Long Sleeve Tee','Apparel','Same heavyweight cotton as the Eye Tee with a ribbed cuff and the sign-off printed down one sleeve.',2900,'tee',8)
  returning id, name)
insert into public.product_variants (product_id, size, color, stock)
select p.id, v.size, v.color, v.stock from p join (values
 ('Eye Tee','S','Black',10),('Eye Tee','M','Black',12),('Eye Tee','L','Black',12),('Eye Tee','XL','Black',8),
 ('Eye Tee','M','Bone',8),('Eye Tee','L','Bone',8),
 ('Beyond Hoodie','M','Charcoal',6),('Beyond Hoodie','L','Charcoal',6),('Beyond Hoodie','XL','Charcoal',4),
 ('Dusk Cap','One size','Black',3),('Dusk Cap','One size','Bone',0),
 ('Field Tote','One size','Bone',40),('Field Tote','One size','Black',20),
 ('Campfire Mug','350 ml','Black',20),('Campfire Mug','350 ml','Bone',15),
 ('Unseen Print, A3','A3','Black',4),
 ('Eye Pin Set','Set of 3','Black',0),
 ('Long Sleeve Tee','M','Charcoal',10),('Long Sleeve Tee','L','Charcoal',10),('Long Sleeve Tee','M','Bone',4)
) as v(pname,size,color,stock) on v.pname = p.name;
