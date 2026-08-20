// Test-only QR decoder. Reads a generated grid back the way a scanner would, so
// scripts/smoke.mjs can prove the encoder round-trips instead of only checking that
// the finder patterns look right. A QR that renders beautifully and decodes to
// nothing is the failure mode this exists to catch.
//
// Deliberately independent of src/qr.js beyond the shared constants.
const ALIGN = { 1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30], 6: [6,34] };
const LV = {
  M: { bits: 0b00, v: {1:{d:16,e:10,b:1},2:{d:28,e:16,b:1},3:{d:44,e:26,b:1},4:{d:64,e:18,b:2},5:{d:86,e:24,b:2},6:{d:108,e:16,b:4}} },
  L: { bits: 0b01, v: {1:{d:19,e:7,b:1},2:{d:34,e:10,b:1},3:{d:55,e:15,b:1},4:{d:80,e:20,b:1},5:{d:108,e:26,b:1},6:{d:136,e:18,b:2}} },
};
const MASKS = [
  (r,c)=>(r+c)%2===0, (r)=>r%2===0, (r,c)=>c%3===0, (r,c)=>(r+c)%3===0,
  (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0, (r,c)=>((r*c)%2)+((r*c)%3)===0,
  (r,c)=>(((r*c)%2)+((r*c)%3))%2===0, (r,c)=>(((r+c)%2)+((r*c)%3))%2===0,
];

function reservedMap(size, version) {
  const R = Array.from({length:size},()=>new Array(size).fill(false));
  const mark=(r,c)=>{ if(r>=0&&c>=0&&r<size&&c<size) R[r][c]=true; };
  const finder=(r0,c0)=>{ for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++) mark(r0+r,c0+c); };
  finder(0,0); finder(0,size-7); finder(size-7,0);
  for(let i=8;i<size-8;i++){ mark(6,i); mark(i,6); }
  const al=ALIGN[version];
  for(const r of al) for(const c of al){
    if((r===6&&c===6)||(r===6&&c===size-7)||(r===size-7&&c===6)) continue;
    for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++) mark(r+dr,c+dc);
  }
  mark(size-8,8);
  for(let i=0;i<9;i++){ if(i===6) continue; mark(8,i); mark(i,8); }
  for(let i=0;i<8;i++){ mark(8,size-1-i); mark(size-1-i,8); }
  return R;
}

// Reads the format word the way a scanner does: bit i of the masked 15-bit value
// comes from (i,8) low down column 8 and from (8,size-1-i) along row 8.
function readFormat(g,size){
  let raw=0;
  for(let i=0;i<15;i++){
    let v;
    if(i<6) v=g[i][8];
    else if(i<8) v=g[i+1][8];
    else v=g[size-15+i][8];
    raw |= (v?1:0)<<i;
  }
  const f = raw ^ 0x5412;
  return { level: (f>>13)&0b11, mask: (f>>10)&0b111 };
}

export function decode(g){
  const size=g.length, version=(size-17)/4;
  const { level, mask } = readFormat(g,size);
  const levelName = level===0b00?"M":level===0b01?"L":"?";
  const R = reservedMap(size,version);
  const bits=[];
  let up=true;
  for(let col=size-1;col>0;col-=2){
    if(col===6) col--;
    for(let k=0;k<size;k++){
      const row = up? size-1-k : k;
      for(const c of [col,col-1]){
        if(R[row][c]) continue;
        bits.push(g[row][c] ^ (MASKS[mask](row,c)?1:0));
      }
    }
    up=!up;
  }
  const words=[];
  for(let i=0;i+8<=bits.length;i+=8){ let v=0; for(let j=0;j<8;j++) v=(v<<1)|bits[i+j]; words.push(v); }
  const spec=LV[levelName].v[version];
  const per=spec.d/spec.b;
  const blocks=Array.from({length:spec.b},()=>[]);
  for(let i=0;i<per;i++) for(let b=0;b<spec.b;b++) blocks[b].push(words[i*spec.b+b]);
  const data=[].concat(...blocks);
  let bi=0;
  const take=(n)=>{ let v=0; for(let i=0;i<n;i++){ const byte=data[Math.floor(bi/8)]; const b=(byte>>(7-(bi%8)))&1; v=(v<<1)|b; bi++; } return v; };
  const mode=take(4); const len=take(8);
  if(mode!==0b0100) return { error:"mode="+mode.toString(2) };
  const out=[]; for(let i=0;i<len;i++) out.push(take(8));
  return { levelName, version, text: new TextDecoder().decode(Uint8Array.from(out)) };
}

