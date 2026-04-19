let p=JSON.parse(localStorage.getItem('p')||'[]');
function save(){localStorage.setItem('p',JSON.stringify(p))}
function show(x){
products.style.display='none';
invoice.style.display='none';
document.getElementById(x).style.display='block';
if(x=='invoice') render();
if(x=='products') renderProducts();
}
function add(){
p.push({en:en.value,ar:ar.value,price:+price.value,bag:+bag.value||5});
save();renderProducts();
}
function renderProducts(){
list.innerHTML='';
p.forEach(i=>{
let li=document.createElement('li');
li.innerText=i.en+' '+i.bag+'kg';
list.appendChild(li);
});
}
let inv=[];
function render(){
invDiv.innerHTML='';
p.forEach((i,x)=>{
let d=document.createElement('div');
d.innerHTML=i.en+' <button onclick="addItem('+x+')">+1 bag</button>';
invDiv.appendChild(d);
});
}
function addItem(i){
let it=p[i];
inv.push(it);
calc();
}
function calc(){
let t=0;
inv.forEach(i=>t+=i.bag*i.price);
total.innerText=t.toFixed(2);
}
renderProducts();
