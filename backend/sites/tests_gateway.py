from django.test import SimpleTestCase

from sites.gateway_routing import RenderedRoute, normalize_api_route_path, render_frontend_gateway_nginx


class NormalizeApiRoutePathTests(SimpleTestCase):
    def test_normalizes_supported_inputs(self):
        self.assertEqual(normalize_api_route_path('payments'), '/api/payments/')
        self.assertEqual(normalize_api_route_path('/api/PAYMENTS'), '/api/payments/')
        self.assertEqual(normalize_api_route_path('/api/payments/'), '/api/payments/')

    def test_rejects_invalid_format(self):
        with self.assertRaises(ValueError):
            normalize_api_route_path('/api/')

        with self.assertRaises(ValueError):
            normalize_api_route_path('/api/v1/users')


class RenderFrontendGatewayNginxTests(SimpleTestCase):
    def test_custom_routes_render_before_default_api_block(self):
        config = render_frontend_gateway_nginx(
            site_name='demo',
            backend_services=['demo_backend_1', 'demo_backend_2'],
            custom_routes=[
                RenderedRoute(path='/api/payments/', target_url='http://payments:3000', strip_prefix=True),
                RenderedRoute(path='/api/orders/', target_url='http://orders:4000', strip_prefix=False),
            ],
        )

        self.assertIn('location ^~ /api/payments/', config)
        self.assertIn('location ^~ /api/orders/', config)
        self.assertIn('rewrite ^/api/payments/?(.*)$ /$1 break;', config)
        self.assertIn('proxy_pass http://demo_api;', config)

        payments_idx = config.index('location ^~ /api/payments/')
        default_idx = config.index('location /api/')
        self.assertLess(payments_idx, default_idx)
