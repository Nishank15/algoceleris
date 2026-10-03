import os
import re
import unittest


class TestHAProxyConfig(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Resolve config path relative to repository root
        test_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(test_dir, "../../.."))
        cls.config_path = os.path.join(repo_root, "deploy/haproxy/haproxy.cfg")
        cls.docker_compose_path = os.path.join(repo_root, "deploy/docker-compose.yml")

        with open(cls.config_path, "r", encoding="utf-8") as f:
            cls.config_text = f.read()

        # Parse sections
        cls.sections = cls._parse_sections(cls.config_text)

    @classmethod
    def _parse_sections(cls, text: str):
        sections = {}
        current_section = None
        current_lines = []

        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            # Check for section headers
            tokens = stripped.split()
            header_type = tokens[0]
            if header_type in ("global", "defaults", "frontend", "backend", "listen"):
                if current_section:
                    sections[current_section] = current_lines
                current_section = f"{header_type} {tokens[1]}" if len(tokens) > 1 else header_type
                current_lines = []
            else:
                if current_lines is not None:
                    current_lines.append(stripped)

        if current_section:
            sections[current_section] = current_lines

        return sections

    def test_file_exists(self):
        """Configuration file exists on disk."""
        self.assertTrue(os.path.exists(self.config_path))
        self.assertTrue(os.path.exists(self.docker_compose_path))

    def test_global_and_defaults(self):
        """Defaults section configures HTTP mode, forwardfor, and timeouts."""
        self.assertIn("defaults", self.sections)
        defaults_text = " ".join(self.sections["defaults"])
        self.assertRegex(defaults_text, r"mode\s+http")
        self.assertRegex(defaults_text, r"option\s+forwardfor")
        self.assertRegex(defaults_text, r"timeout\s+tunnel")

    def test_websocket_acls(self):
        """Frontend ingress_http inspects Upgrade header and /ws/ path."""
        self.assertIn("frontend ingress_http", self.sections)
        frontend_text = " ".join(self.sections["frontend_http"] if "frontend_http" in self.sections else self.sections["frontend ingress_http"])

        # WebSocket header ACL
        self.assertRegex(frontend_text, r"acl\s+is_websocket\s+hdr\(Upgrade\)\s+-i\s+WebSocket")
        # WebSocket path ACL
        self.assertRegex(frontend_text, r"acl\s+is_ws_path\s+path_beg\s+/ws/")
        # Routing condition
        self.assertIn("use_backend gateway_ws_cluster", frontend_text)
        self.assertIn("default_backend gateway_api_cluster", frontend_text)

    def test_api_backend_roundrobin_and_health_checks(self):
        """API backend uses roundrobin balancing and queries /health."""
        self.assertIn("backend gateway_api_cluster", self.sections)
        api_text = " ".join(self.sections["backend gateway_api_cluster"])

        self.assertIn("balance roundrobin", api_text)
        self.assertIn("option httpchk GET /health", api_text)
        self.assertIn("http-check expect status 200", api_text)

        # Check servers
        self.assertRegex(api_text, r"server\s+gateway_1\s+gateway_1:8000\s+check")
        self.assertRegex(api_text, r"server\s+gateway_2\s+gateway_2:8000\s+check")

    def test_ws_backend_tunnel_timeout_and_leastconn(self):
        """WebSocket backend uses leastconn and long tunnel timeout."""
        self.assertIn("backend gateway_ws_cluster", self.sections)
        ws_text = " ".join(self.sections["backend gateway_ws_cluster"])

        self.assertIn("balance leastconn", ws_text)
        self.assertRegex(ws_text, r"timeout\s+tunnel\s+3600000ms")
        self.assertIn("server gateway_1 gateway_1:8000 check", ws_text)
        self.assertIn("server gateway_2 gateway_2:8000 check", ws_text)

    def test_stats_listener(self):
        """Admin stats listener is enabled on port 8404 at /stats."""
        self.assertIn("listen stats", self.sections)
        stats_text = " ".join(self.sections["listen stats"])

        self.assertIn("bind 0.0.0.0:8404", stats_text)
        self.assertIn("stats enable", stats_text)
        self.assertIn("stats uri /stats", stats_text)

    def test_docker_compose_multi_instance_topology(self):
        """Docker compose defines haproxy, redis, worker, and at least 2 gateway instances."""
        with open(self.docker_compose_path, "r", encoding="utf-8") as f:
            compose_text = f.read()

        self.assertIn("haproxy:", compose_text)
        self.assertIn("gateway_1:", compose_text)
        self.assertIn("gateway_2:", compose_text)
        self.assertIn("redis:", compose_text)
        self.assertIn("worker:", compose_text)
        self.assertIn("8080:80", compose_text)
        self.assertIn("8404:8404", compose_text)


if __name__ == "__main__":
    unittest.main()
