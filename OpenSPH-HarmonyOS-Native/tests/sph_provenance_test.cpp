#include "sph_provenance.h"
#include <iostream>
using namespace lab;
void require(bool b,const char* s){if(!b)throw std::runtime_error(s);}
int main(){try{
 std::vector<StructureParticle> p={{2,{0,0,0},{}},{8,{.1,0,0},{}},{3,{10,0,0},{}},{7,{10.1,0,0},{}},{11,{20,0,0},{}}};
 std::vector<double> h(5,1);std::vector<ParticleOrigin> origins={{2,0},{8,1},{3,0},{7,1},{11,0}};
 auto f=measureSphFragments(p,h);const auto result=measureFragmentOrigins(f,origins,31);
 require(result.totals==std::array<double,2>{16,15},"total source mass");
 require(result.groups==std::vector<std::array<double,2>>{{11,0},{2,8},{3,7}},"weighted per-group source, not particle count or global average");
 auto permuted=p;auto reordered=origins;const int order[]={2,0,3,1,4};for(int i=0;i<5;i++){permuted[i]=p[order[i]];reordered[i]=origins[order[i]];}
 const auto pf=measureSphFragments(permuted,h);const auto pr=measureFragmentOrigins(pf,reordered,31);require(pr.totals==result.totals,"permutation changed total");
 for(size_t i=0;i<f.groups.size();i++)for(size_t j=0;j<pf.groups.size();j++)if(f.groups[i].center==pf.groups[j].center)require(result.groups[i]==pr.groups[j],"permutation changed source mass");
 auto split=measureSphFragments(p,std::vector<double>(5,.01));auto separated=measureFragmentOrigins(split,origins,31);require(split.groups.size()==5&&separated.totals==result.totals,"split loses origin");
 auto merged=measureSphFragments(p,std::vector<double>(5,30));auto together=measureFragmentOrigins(merged,origins,31);require(merged.groups.size()==1&&together.groups[0]==result.totals,"merge loses origin");
 for(int variant=0;variant<5;variant++){auto bad=origins;if(variant==0)bad.pop_back();if(variant==1)bad[0].source=2;if(variant==2)bad[0].massKg=NAN;if(variant==3)bad[0].massKg=-1;if(variant==4)bad[0].massKg=3;bool failed=false;try{measureFragmentOrigins(f,bad,31);}catch(...){failed=true;}require(failed,"bad provenance accepted");}
 std::cout<<"PASS unequal particle masses, source totals, per-fragment mixtures, permutation, split/merge and invalid provenance rejection\n";
}catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
