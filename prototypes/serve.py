# 試作ページ用の簡易サーバー。ファイルを直したらすぐ反映されるよう、ブラウザにキャッシュさせない。
# 使い方: python serve.py [ポート番号]
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
handler = functools.partial(NoCacheHandler, directory=os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
