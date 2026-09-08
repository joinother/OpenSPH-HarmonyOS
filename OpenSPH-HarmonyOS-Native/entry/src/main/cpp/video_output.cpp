#include "video_output.h"
#include <GLES3/gl3.h>
#include <native_window/external_window.h>
#include <algorithm>
#include <chrono>
#include <mutex>
#include <stdexcept>
namespace lab { namespace {
std::mutex guard;
uint64_t requested=0,current=0;
VideoOutputStatus status;
OHNativeWindow* window=nullptr;
EGLSurface target=EGL_NO_SURFACE;
// Small original bitmap alphabet; credit is burned into exports that show the licensed sky.
void credit(int width) {
    const char* lines[]={"SKY: ESO/S. BRUNIER - CC BY 4.0","ESO.ORG/PUBLIC/IMAGES/ESO0932A/ (ADAPTED)"};
    int scale=width>=900?2:1;
    glEnable(GL_SCISSOR_TEST);glScissor(4,4,232*scale,20*scale);glClearColor(.035f,.035f,.05f,1);glClear(GL_COLOR_BUFFER_BIT);
    glClearColor(.72f,.70f,.76f,1);
    for(int line=0;line<2;line++)for(int i=0;lines[line][i];i++){
        const unsigned char* rows=nullptr;
        switch(lines[line][i]){
        case 'A':{static const unsigned char glyph[]={14,17,17,31,17,17,17};rows=glyph;break;}
        case 'B':{static const unsigned char glyph[]={30,17,17,30,17,17,30};rows=glyph;break;}
        case 'C':{static const unsigned char glyph[]={14,17,16,16,16,17,14};rows=glyph;break;}
        case 'D':{static const unsigned char glyph[]={30,17,17,17,17,17,30};rows=glyph;break;}
        case 'E':{static const unsigned char glyph[]={31,16,16,30,16,16,31};rows=glyph;break;}
        case 'F':{static const unsigned char glyph[]={31,16,16,30,16,16,16};rows=glyph;break;}
        case 'G':{static const unsigned char glyph[]={14,17,16,23,17,17,15};rows=glyph;break;}
        case 'H':{static const unsigned char glyph[]={17,17,17,31,17,17,17};rows=glyph;break;}
        case 'I':{static const unsigned char glyph[]={14,4,4,4,4,4,14};rows=glyph;break;}
        case 'J':{static const unsigned char glyph[]={7,2,2,2,2,18,12};rows=glyph;break;}
        case 'K':{static const unsigned char glyph[]={17,18,20,24,20,18,17};rows=glyph;break;}
        case 'L':{static const unsigned char glyph[]={16,16,16,16,16,16,31};rows=glyph;break;}
        case 'M':{static const unsigned char glyph[]={17,27,21,21,17,17,17};rows=glyph;break;}
        case 'N':{static const unsigned char glyph[]={17,25,21,19,17,17,17};rows=glyph;break;}
        case 'O':{static const unsigned char glyph[]={14,17,17,17,17,17,14};rows=glyph;break;}
        case 'P':{static const unsigned char glyph[]={30,17,17,30,16,16,16};rows=glyph;break;}
        case 'Q':{static const unsigned char glyph[]={14,17,17,17,21,18,13};rows=glyph;break;}
        case 'R':{static const unsigned char glyph[]={30,17,17,30,20,18,17};rows=glyph;break;}
        case 'S':{static const unsigned char glyph[]={15,16,16,14,1,1,30};rows=glyph;break;}
        case 'T':{static const unsigned char glyph[]={31,4,4,4,4,4,4};rows=glyph;break;}
        case 'U':{static const unsigned char glyph[]={17,17,17,17,17,17,14};rows=glyph;break;}
        case 'V':{static const unsigned char glyph[]={17,17,17,17,17,10,4};rows=glyph;break;}
        case 'W':{static const unsigned char glyph[]={17,17,17,21,21,21,10};rows=glyph;break;}
        case 'X':{static const unsigned char glyph[]={17,17,10,4,10,17,17};rows=glyph;break;}
        case 'Y':{static const unsigned char glyph[]={17,17,10,4,4,4,4};rows=glyph;break;}
        case 'Z':{static const unsigned char glyph[]={31,1,2,4,8,16,31};rows=glyph;break;}
        case '0':{static const unsigned char glyph[]={14,17,19,21,25,17,14};rows=glyph;break;}
        case '1':{static const unsigned char glyph[]={4,12,4,4,4,4,14};rows=glyph;break;}
        case '2':{static const unsigned char glyph[]={14,17,1,2,4,8,31};rows=glyph;break;}
        case '3':{static const unsigned char glyph[]={30,1,1,14,1,1,30};rows=glyph;break;}
        case '4':{static const unsigned char glyph[]={2,6,10,18,31,2,2};rows=glyph;break;}
        case '5':{static const unsigned char glyph[]={31,16,16,30,1,1,30};rows=glyph;break;}
        case '6':{static const unsigned char glyph[]={14,16,16,30,17,17,14};rows=glyph;break;}
        case '7':{static const unsigned char glyph[]={31,1,2,4,8,8,8};rows=glyph;break;}
        case '8':{static const unsigned char glyph[]={14,17,17,14,17,17,14};rows=glyph;break;}
        case '9':{static const unsigned char glyph[]={14,17,17,15,1,1,14};rows=glyph;break;}
        case '.':{static const unsigned char glyph[]={0,0,0,0,0,12,12};rows=glyph;break;}
        case '/':{static const unsigned char glyph[]={1,1,2,4,8,16,16};rows=glyph;break;}
        case ':':{static const unsigned char glyph[]={0,4,4,0,4,4,0};rows=glyph;break;}
        case '-':{static const unsigned char glyph[]={0,0,0,31,0,0,0};rows=glyph;break;}
        case '(':{static const unsigned char glyph[]={2,4,8,8,8,4,2};rows=glyph;break;}
        case ')':{static const unsigned char glyph[]={8,4,2,2,2,4,8};rows=glyph;break;}
        default:break;
        }
        if(!rows)continue;
        for(int row=0;row<7;row++)for(int col=0;col<5;col++)if(rows[row]&(1<<(4-col))){
            glScissor(8+(i*6+col)*scale,8+((1-line)*9+6-row)*scale,scale,scale);glClear(GL_COLOR_BUFFER_BIT);
        }
    }
    glDisable(GL_SCISSOR_TEST);
}
void close(EGLDisplay display) {
    if(target!=EGL_NO_SURFACE)eglDestroySurface(display,target);
    if(window)OH_NativeWindow_DestroyNativeWindow(window);
    window=nullptr;target=EGL_NO_SURFACE;current=0;status.attached=false;
}
void fail(EGLDisplay display,const std::string& reason) {close(display);requested=0;status.pending=false;status.error=reason;}
}
void requestVideoOutput(uint64_t id,int w,int h) {
    std::lock_guard<std::mutex> lock(guard);
    if(id){
        if(requested||current)throw std::invalid_argument("Video output already in use");
        if(w<128||h<128||w>1920||h>1920||w%2||h%2)throw std::invalid_argument("Invalid video dimensions");
        status={};status.width=w;status.height=h;
    }
    requested=id;status.pending=(requested!=current);
}
VideoOutputStatus videoOutputStatus(){std::lock_guard<std::mutex> lock(guard);return status;}
void updateVideoOutput(EGLDisplay display,EGLConfig config) {
    std::lock_guard<std::mutex> lock(guard);
    if(requested==current)return;
    close(display);
    if(!requested){status.pending=false;return;}
    int result=OH_NativeWindow_CreateNativeWindowFromSurfaceId(requested,&window);
    if(result||!window){fail(display,"Video window: "+std::to_string(result));return;}
    result=OH_NativeWindow_NativeWindowHandleOpt(window,SET_BUFFER_GEOMETRY,status.width,status.height);
    if(result){fail(display,"Video dimensions: "+std::to_string(result));return;}
    target=eglCreateWindowSurface(display,config,reinterpret_cast<EGLNativeWindowType>(window),nullptr);
    if(target==EGL_NO_SURFACE){fail(display,"Video EGL surface: "+std::to_string(eglGetError()));return;}
    current=requested;status.pending=false;status.attached=true;
}
bool submitVideoOutput(EGLDisplay display,EGLContext context,EGLSurface screen,int w,int h,bool photo) {
    std::lock_guard<std::mutex> lock(guard);
    if(!current||!requested)return true;
    if(!eglMakeCurrent(display,target,screen,context)){fail(display,"Video context unavailable");return eglMakeCurrent(display,screen,screen,context);}
    glBindFramebuffer(GL_READ_FRAMEBUFFER,0);glBindFramebuffer(GL_DRAW_FRAMEBUFFER,0);
    glDisable(GL_SCISSOR_TEST);
    glClearColor(0,0,0,1);glClear(GL_COLOR_BUFFER_BIT);
    // Fit the whole viewport into the recording's fixed canvas, preserving aspect after rotation/folding.
    double scale=std::min(double(status.width)/w,double(status.height)/h);
    int dw=std::max(1,int(w*scale)),dh=std::max(1,int(h*scale));
    int x=(status.width-dw)/2,y=(status.height-dh)/2;
    glBlitFramebuffer(0,0,w,h,x,y,x+dw,y+dh,GL_COLOR_BUFFER_BIT,GL_LINEAR);
    if(photo)credit(status.width);
    GLenum error=glGetError();
    uint64_t stamp=std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
    OH_NativeWindow_NativeWindowHandleOpt(window,SET_UI_TIMESTAMP,stamp);
    bool swapped=error==GL_NO_ERROR&&eglSwapBuffers(display,target);
    bool restored=eglMakeCurrent(display,screen,screen,context);
    if(!swapped||!restored){fail(display,"Video frame submission failed: "+std::to_string(error));return restored;}
    ++status.frames;return true;
}
void releaseVideoOutput(EGLDisplay display){std::lock_guard<std::mutex> lock(guard);if(current||requested)status.error="Viewport closed during recording";close(display);requested=0;status.pending=false;}
}
