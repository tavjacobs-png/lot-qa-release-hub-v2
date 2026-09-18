export async function GET(request){
  const target=new URL(request.url).searchParams.get("url");
  if(!target||!/^https?:\/\//i.test(target))return new Response("Bad URL",{status:400});
  try{
    const r=await fetch(target,{headers:{"User-Agent":"Mozilla/5.0","Accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8","Referer":new URL(target).origin+"/"},redirect:"follow"});
    if(!r.ok)return new Response("Image unavailable",{status:502});
    const type=r.headers.get("content-type")||"image/jpeg";
    if(!type.startsWith("image/"))return new Response("Not an image",{status:502});
    return new Response(await r.arrayBuffer(),{headers:{"Content-Type":type,"Cache-Control":"public, max-age=86400"}});
  }catch{return new Response("Image unavailable",{status:502})}
}
