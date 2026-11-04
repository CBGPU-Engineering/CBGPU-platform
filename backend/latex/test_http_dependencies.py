"""Loopback-only compatibility smoke test for the pinned aiohttp runtime."""
import unittest
from aiohttp import ClientSession, web
from aiohttp.test_utils import TestServer

class HttpRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_json_request_and_shutdown(self):
        async def health(request):
            return web.json_response({"healthy": True})
        app = web.Application()
        app.router.add_get('/health', health)
        async with TestServer(app) as server:
            async with ClientSession() as client:
                async with client.get(server.make_url('/health')) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(await response.json(), {"healthy": True})

if __name__ == '__main__':
    unittest.main()
