const T=[ // name,cat,price,prep,veg,spice,allergens(null=unknown),ingredients
["Shepherd's salad","starter",6,5,1,0,[],"tomato,cucumber,onion,herbs"],
["Qutab with cheese","starter",7,8,1,0,["gluten","dairy"],"cheese,herbs,flatbread"],
["Hummus","starter",8,5,1,0,["sesame"],"chickpea,tahini,olive oil"],
["Dolma","starter",9,12,0,0,[],"grape leaves,lamb,rice"],
["Chef's soup of the day","starter",7,10,1,0,null,"daily recipe"],
["Plov","main",16,25,0,0,[],"rice,lamb,dried fruit,saffron"],
["Dushbara","main",11,15,0,0,["gluten","egg"],"dumplings,lamb broth,mint"],
["Vegetarian pasta","main",12,12,1,1,["gluten","dairy"],"pasta,tomato,zucchini,parmesan"],
["Mushroom risotto","main",14,18,1,0,["dairy"],"rice,mushrooms,cream"],
["Falafel plate","main",11,10,1,1,["sesame"],"chickpea,tahini,salad"],
["Lamb kebab","main",18,22,0,2,[],"lamb,onion,sumac,flatbread"],
["Spicy chicken wings","main",13,14,0,3,[],"chicken,chili,garlic"],
["Grilled sea bass","main",21,20,0,0,["fish"],"sea bass,lemon,vegetables"],
["Ayran","drink",3,1,1,0,["dairy"],"yogurt,water,salt"],
["Homemade lemonade","drink",4,3,1,0,[],"lemon,mint,sugar"],
["Black tea (armudu)","drink",2.5,3,1,0,[],"tea"],
["Pakhlava","dessert",6,2,1,0,["gluten","nuts"],"walnut,pastry,honey"],
["Ice cream","dessert",5,2,1,0,["dairy"],"milk,cream,sugar"]];
const X={"Shepherd's salad":{emo:'🥗',kw:'greek,salad'},"Qutab with cheese":{emo:'🫓',kw:'flatbread,cheese',badge:'Popular'},"Hummus":{emo:'🧆',kw:'hummus'},"Dolma":{emo:'🍇',kw:'dolma'},"Chef's soup of the day":{emo:'🍲',kw:'soup'},
"Plov":{emo:'🍛',kw:'pilaf,rice',badge:"Chef's pick"},"Dushbara":{emo:'🥟',kw:'dumplings'},"Vegetarian pasta":{emo:'🍝',kw:'pasta,tomato'},"Mushroom risotto":{emo:'🍄',kw:'risotto',badge:'Popular'},"Falafel plate":{emo:'🧆',kw:'falafel'},
"Lamb kebab":{emo:'🍢',kw:'kebab',badge:"Chef's pick"},"Spicy chicken wings":{emo:'🍗',kw:'chicken,wings'},"Grilled sea bass":{emo:'🐟',kw:'grilled,fish'},"Ayran":{emo:'🥛',kw:'yogurt,drink'},"Homemade lemonade":{emo:'🍋',kw:'lemonade'},
"Black tea (armudu)":{emo:'🍵',kw:'black,tea'},"Pakhlava":{emo:'🍯',kw:'baklava',badge:'Sweet finish'},"Ice cream":{emo:'🍨',kw:'ice,cream'}};
const W={"Shepherd's salad":"Shepherd's salad","Qutab with cheese":"Qutab","Hummus":"Hummus","Dolma":"Dolma","Chef's soup of the day":"Soup","Plov":"Pilaf","Dushbara":"Dushbara","Vegetarian pasta":"Pasta","Mushroom risotto":"Risotto","Falafel plate":"Falafel","Lamb kebab":"Shish kebab","Spicy chicken wings":"Buffalo wing","Grilled sea bass":"European bass","Ayran":"Ayran","Homemade lemonade":"Lemonade","Black tea (armudu)":"Tea","Pakhlava":"Baklava","Ice cream":"Ice cream"}; // Wikipedia article titles used to fetch real dish photos
export const DEMO={id:'demo',name:'Qala Bistro',tagline:'Modern Azerbaijani kitchen · Old City, Baku',currency:'₼',
  hero:'restaurant,interior',menu:T.map((t,i)=>({id:'i'+(i+1),name:t[0],cat:t[1],price:t[2],prep:t[3],veg:!!t[4],spice:t[5],allergens:t[6],ingredients:t[7].split(','),desc:t[7].replace(/,/g,', '),available:true,...(X[t[0]]||{}),wiki:W[t[0]]||t[0]}))};
export const demoText=T.map(t=>`${t[0]} - ${t[7].replace(/,/g,', ')} - ${t[2]}`).join('\n');
