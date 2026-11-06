// Fuzzy name matching: tolerant to case, accents, punctuation and small typos.
(function(){
  function norm(s){
    return s.toLowerCase().replace(/ß/g,"ss").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/^(der|die|das|the)\s+/,"")
      .replace(/^(golf von|gulf of|bay of|sea of|strasse von|strait of|kanal von|bucht von|meerbusen von|golfo de)\s+/,"")
      .replace(/^(rio|fluss|river|strom|lake|lago|lac|lac de|lago de|ozero|danau|see)\s+/,"")
      .replace(/\s+(ozean|ocean|meer|sea|golf|gulf|bucht|bay|bai)$/,"")
      .replace(/\s+(fluss|river|strom|lake|see)$/,"")
      .replace(/^(.{3,}?)-?see$/,"$1")
      .replace(/[^a-z0-9]/g,"");
  }
  // Damerau-Levenshtein (optimal string alignment)
  function dist(a,b){
    const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
    const d=[]; for(let i=0;i<=m;i++){d[i]=[i];} for(let j=0;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
      const c=a[i-1]===b[j-1]?0:1;
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
    }
    return d[m][n];
  }
  function tolerance(len){ return len<=2?0:len<=5?1:len<=9?2:3; }
  // returns {ok, exact, matched}
  function check(input,names){
    const x=norm(input); if(!x) return {ok:false};
    let best=null;
    for(const n of names){
      const y=norm(n); if(!y) continue;
      const d=dist(x,y);
      if(d===0) return {ok:true,exact:true,matched:n};
      if(d<=tolerance(y.length)&&(!best||d<best.d)) best={d,n};
    }
    return best?{ok:true,exact:false,matched:best.n,d:best.d}:{ok:false};
  }
  window.Fuzzy={norm,dist,check,tolerance};
})();
