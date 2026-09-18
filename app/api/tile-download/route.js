import {NextResponse} from 'next/server';

function safeName(name='game-tile'){
  return name.replace(/[^a-z0-9 _-]/gi,'').trim().replace(/\s+/g,'-').toLowerCase()||'game-tile';
}

export async function GET(req){
  const {searchParams}=new URL(req.url);
  const url=searchParams.get('url');
  const name=safeName(searchParams.get('name')||'game-tile');
  if(!url)return NextResponse.json({error:'Missing image URL'},{status:400});
  try{
    const upstream=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},cache:'no-store'});
    if(!upstream.ok)throw new Error('Could not fetch tile');
    const input=Buffer.from(await upstream.arrayBuffer());
    const sharp=(await import('sharp')).default;
    const output=await sharp(input).resize(800,800,{fit:'fill'}).png().toBuffer();
    return new NextResponse(output,{headers:{'Content-Type':'image/png','Content-Disposition':`attachment; filename="${name}-800x800.png"`,'Cache-Control':'no-store'}});
  }catch(e){
    return NextResponse.json({error:e.message||'Could not prepare tile'},{status:500});
  }
}
