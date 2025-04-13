<?php
/**
 * Router.php - Sistema de enrutamiento para la API del portal de criptomonedas
 * 
 * Este archivo implementa un sistema de enrutamiento flexible y potente para 
 * gestionar todas las solicitudes a la API RESTful del portal de criptomonedas.
 * 
 * @package CryptoAPI
 * @subpackage Routing
 * @author Coxotropic CryptoPortal Team
 * @version 1.0.0
 */

namespace CryptoAPI\Routing;

use Exception;
use Closure;

/**
 * Clase Router - Gestiona el enrutamiento de solicitudes a la API
 * 
 * Esta clase se encarga de registrar rutas, aplicar middleware, manejar
 * parámetros dinámicos en las rutas y dirigir las solicitudes a los 
 * controladores apropiados.
 */
class Router
{
    /**
     * Colección de rutas registradas organizadas por método HTTP
     * 
     * @var array
     */
    protected $routes = [
        'GET' => [],
        'POST' => [],
        'PUT' => [],
        'DELETE' => [],
        'PATCH' => []
    ];
    
    /**
     * Prefijo actual para las rutas (usado en grupos)
     * 
     * @var string
     */
    protected $prefix = '';
    
    /**
     * Middleware para aplicar a un grupo de rutas
     * 
     * @var array
     */
    protected $groupMiddleware = [];
    
    /**
     * Middleware global que se aplica a todas las rutas
     * 
     * @var array
     */
    protected $globalMiddleware = [];
    
    /**
     * Colección de middleware registrados por nombre
     * 
     * @var array
     */
    protected $middlewareMap = [];
    
    /**
     * URL base para la generación de URLs
     * 
     * @var string
     */
    protected $baseUrl = '';
    
    /**
     * Constructor de la clase Router
     * 
     * @param string $baseUrl URL base para la generación de URLs
     */
    public function __construct(string $baseUrl = '')
    {
        $this->baseUrl = $baseUrl;
    }
    
    /**
     * Registra una ruta GET
     * 
     * @param string $uri La URI de la ruta
     * @param mixed $handler El controlador que manejará la solicitud
     * @param array $middleware Lista de middleware a aplicar a esta ruta
     * @return self
     */
    public function get(string $uri, $handler, array $middleware = []): self
    {
        return $this->addRoute('GET', $uri, $handler, $middleware);
    }
    
    /**
     * Registra una ruta POST
     * 
     * @param string $uri La URI de la ruta
     * @param mixed $handler El controlador que manejará la solicitud
     * @param array $middleware Lista de middleware a aplicar a esta ruta
     * @return self
     */
    public function post(string $uri, $handler, array $middleware = []): self
    {
        return $this->addRoute('POST', $uri, $handler, $middleware);
    }
    
    /**
     * Registra una ruta PUT
     * 
     * @param string $uri La URI de la ruta
     * @param mixed $handler El controlador que manejará la solicitud
     * @param array $middleware Lista de middleware a aplicar a esta ruta
     * @return self
     */
    public function put(string $uri, $handler, array $middleware = []): self
    {
        return $this->addRoute('PUT', $uri, $handler, $middleware);
    }
    
    /**
     * Registra una ruta DELETE
     * 
     * @param string $uri La URI de la ruta
     * @param mixed $handler El controlador que manejará la solicitud
     * @param array $middleware Lista de middleware a aplicar a esta ruta
     * @return self
     */
    public function delete(string $uri, $handler, array $middleware = []): self
    {
        return $this->addRoute('DELETE', $uri, $handler, $middleware);
    }
    
    /**
     * Registra una ruta PATCH
     * 
     * @param string $uri La URI de la ruta
     * @param mixed $handler El controlador que manejará la solicitud
     * @param array $middleware Lista de middleware a aplicar a esta ruta
     * @return self
     */
    public function patch(string $uri, $handler, array $middleware = []): self
    {
        return $this->addRoute('PATCH', $uri, $handler, $middleware);
    }
    
    /**
     * Añade una ruta a la colección de rutas
     * 
     * @param string $method Método HTTP
     * @param string $uri URI de la ruta
     * @param mixed $handler Controlador para la ruta
     * @param array $middleware Lista de middleware para la ruta
     * @return self
     */
    protected function addRoute(string $method, string $uri, $handler, array $middleware = []): self
    {
        // Aplicar prefijo de grupo si existe
        $uri = $this->prefix . '/' . trim($uri, '/');
        $uri = '/' . trim($uri, '/');
        
        // Combinar middleware de grupo con middleware específico de la ruta
        $routeMiddleware = array_merge($this->groupMiddleware, $middleware);
        
        // Añadir la ruta a la colección
        $this->routes[$method][$uri] = [
            'handler' => $handler,
            'middleware' => $routeMiddleware,
            'pattern' => $this->convertUriToRegex($uri)
        ];
        
        return $this;
    }
    
    /**
     * Convierte una URI con parámetros a una expresión regular
     * 
     * @param string $uri URI con posibles parámetros {param}
     * @return array Patrón de expresión regular y nombres de parámetros
     */
    protected function convertUriToRegex(string $uri): array
    {
        $paramNames = [];
        
        // Reemplazar parámetros {param} con grupos de captura regex
        $pattern = preg_replace_callback('/{([^}]+)}/', function($matches) use (&$paramNames) {
            $paramNames[] = $matches[1];
            return '([^/]+)'; // Captura cualquier cosa excepto /
        }, $uri);
        
        // Escapar caracteres especiales y preparar el patrón
        $pattern = '#^' . str_replace('/', '\/', $pattern) . '$#';
        
        return [
            'regex' => $pattern,
            'params' => $paramNames
        ];
    }
    
    /**
     * Agrupa rutas relacionadas con un prefijo común y/o middleware
     * 
     * @param string $prefix Prefijo común para todas las rutas del grupo
     * @param Closure $callback Función que define las rutas del grupo
     * @param array $middleware Middleware a aplicar a todo el grupo
     * @return void
     */
    public function group(string $prefix, Closure $callback, array $middleware = []): void
    {
        // Guardar valores anteriores para restaurar después
        $previousPrefix = $this->prefix;
        $previousGroupMiddleware = $this->groupMiddleware;
        
        // Establecer nuevos valores para el grupo
        $this->prefix = $previousPrefix . '/' . trim($prefix, '/');
        $this->groupMiddleware = array_merge($previousGroupMiddleware, $middleware);
        
        // Ejecutar callback para definir rutas en este grupo
        $callback($this);
        
        // Restaurar valores anteriores
        $this->prefix = $previousPrefix;
        $this->groupMiddleware = $previousGroupMiddleware;
    }
    
    /**
     * Registra middleware global que se aplica a todas las rutas
     * 
     * @param array|string $middleware Middleware a aplicar globalmente
     * @return self
     */
    public function middleware($middleware): self
    {
        if (is_string($middleware)) {
            $middleware = [$middleware];
        }
        
        $this->globalMiddleware = array_merge($this->globalMiddleware, $middleware);
        
        return $this;
    }
    
    /**
     * Registra una clase de middleware con un nombre para referencia fácil
     * 
     * @param string $name Nombre del middleware
     * @param string $class Clase del middleware
     * @return self
     */
    public function registerMiddleware(string $name, string $class): self
    {
        $this->middlewareMap[$name] = $class;
        
        return $this;
    }
    
    /**
     * Genera una URL para una ruta con nombre
     * 
     * @param string $name Nombre de la ruta
     * @param array $params Parámetros para la ruta
     * @return string La URL generada
     * @throws Exception Si la ruta no existe
     */
    public function generateUrl(string $name, array $params = []): string
    {
        // Buscar la ruta por nombre
        $foundUri = null;
        
        foreach ($this->routes as $method => $routes) {
            foreach ($routes as $uri => $route) {
                if (isset($route['name']) && $route['name'] === $name) {
                    $foundUri = $uri;
                    break 2;
                }
            }
        }
        
        if (!$foundUri) {
            throw new Exception("No se encontró ninguna ruta con el nombre: {$name}");
        }
        
        // Reemplazar parámetros en la URI
        $url = $foundUri;
        foreach ($params as $paramName => $paramValue) {
            $url = str_replace("{{$paramName}}", $paramValue, $url);
        }
        
        return $this->baseUrl . $url;
    }
    
    /**
     * Establece un nombre para la última ruta registrada
     * 
     * @param string $name Nombre de la ruta
     * @return self
     */
    public function name(string $name): self
    {
        $methods = array_keys($this->routes);
        
        // Encontrar la última ruta añadida
        $lastMethod = end($methods);
        $lastRouteUri = array_key_last($this->routes[$lastMethod]);
        
        if ($lastRouteUri) {
            $this->routes[$lastMethod][$lastRouteUri]['name'] = $name;
        }
        
        return $this;
    }
    
    /**
     * Procesa la solicitud actual y encuentra la ruta correspondiente
     * 
     * @param string $method Método HTTP
     * @param string $uri URI solicitada
     * @return mixed Resultado del controlador o respuesta de error
     */
    public function dispatch(string $method, string $uri)
    {
        // Normalizar la URI
        $uri = '/' . trim($uri, '/');
        
        // Verificar si existe una ruta exacta
        if (isset($this->routes[$method][$uri])) {
            return $this->handleRoute($this->routes[$method][$uri], []);
        }
        
        // Buscar rutas con parámetros
        foreach ($this->routes[$method] as $route) {
            $pattern = $route['pattern']['regex'];
            
            if (preg_match($pattern, $uri, $matches)) {
                array_shift($matches); // Remover la coincidencia completa
                
                // Asociar valores con nombres de parámetros
                $params = [];
                foreach ($route['pattern']['params'] as $index => $paramName) {
                    $params[$paramName] = $matches[$index] ?? null;
                }
                
                return $this->handleRoute($route, $params);
            }
        }
        
        // No se encontró ninguna ruta
        return $this->handleNotFound();
    }
    
    /**
     * Procesa una ruta con sus middleware y controlador
     * 
     * @param array $route Información de la ruta
     * @param array $params Parámetros extraídos de la URI
     * @return mixed Resultado del controlador
     */
    protected function handleRoute(array $route, array $params)
    {
        $handler = $route['handler'];
        $middleware = array_merge($this->globalMiddleware, $route['middleware']);
        
        // Aplicar middleware (implementación simplificada)
        $next = function() use ($handler, $params) {
            return $this->executeHandler($handler, $params);
        };
        
        // Aplicar middleware en orden inverso (onion model)
        $middlewareStack = $next;
        
        foreach (array_reverse($middleware) as $middleware) {
            $middlewareInstance = $this->resolveMiddleware($middleware);
            
            $middlewareStack = function() use ($middlewareInstance, $middlewareStack, $params) {
                return $middlewareInstance->handle($params, $middlewareStack);
            };
        }
        
        // Ejecutar la pila de middleware
        return $middlewareStack();
    }
    
    /**
     * Resuelve un middleware por nombre o clase
     * 
     * @param string $middleware Nombre o clase del middleware
     * @return object Instancia del middleware
     * @throws Exception Si el middleware no se puede resolver
     */
    protected function resolveMiddleware(string $middleware)
    {
        // Si es un nombre registrado, obtener la clase
        if (isset($this->middlewareMap[$middleware])) {
            $className = $this->middlewareMap[$middleware];
        } else {
            $className = $middleware;
        }
        
        // Verificar si la clase existe
        if (!class_exists($className)) {
            throw new Exception("Middleware no encontrado: {$className}");
        }
        
        // Instanciar el middleware
        return new $className();
    }
    
    /**
     * Ejecuta el controlador de una ruta
     * 
     * @param mixed $handler Controlador (callable, array [clase, método] o string)
     * @param array $params Parámetros para el controlador
     * @return mixed Resultado del controlador
     * @throws Exception Si el controlador no es válido
     */
    protected function executeHandler($handler, array $params)
    {
        // Si es un Closure, simplemente ejecutarlo
        if ($handler instanceof Closure) {
            return call_user_func_array($handler, $params);
        }
        
        // Si es [ControllerClass, method]
        if (is_array($handler) && count($handler) === 2) {
            $className = $handler[0];
            $method = $handler[1];
            
            if (!class_exists($className)) {
                throw new Exception("Controlador no encontrado: {$className}");
            }
            
            $controller = new $className();
            
            if (!method_exists($controller, $method)) {
                throw new Exception("Método no encontrado: {$className}::{$method}");
            }
            
            return call_user_func_array([$controller, $method], $params);
        }
        
        // Si es "ControllerClass@method"
        if (is_string($handler) && strpos($handler, '@') !== false) {
            list($className, $method) = explode('@', $handler, 2);
            
            if (!class_exists($className)) {
                throw new Exception("Controlador no encontrado: {$className}");
            }
            
            $controller = new $className();
            
            if (!method_exists($controller, $method)) {
                throw new Exception("Método no encontrado: {$className}::{$method}");
            }
            
            return call_user_func_array([$controller, $method], $params);
        }
        
        throw new Exception("Tipo de controlador no válido");
    }
    
    /**
     * Maneja una solicitud a una ruta no encontrada
     * 
     * @return array Respuesta de error 404
     */
    protected function handleNotFound()
    {
        http_response_code(404);
        
        return [
            'error' => true,
            'message' => 'Ruta no encontrada',
            'status' => 404
        ];
    }
    
    /**
     * Procesa la solicitud actual tomando información del entorno
     * 
     * @return mixed Resultado del controlador
     */
    public function run()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = $_SERVER['REQUEST_URI'];
        
        // Eliminar query string si existe
        if (strpos($uri, '?') !== false) {
            $uri = strstr($uri, '?', true);
        }
        
        // Manejar peticiones PUT, DELETE, etc. a través de _method
        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper($_POST['_method']);
        }
        
        return $this->dispatch($method, $uri);
    }
}

/**
 * Interfaz para middleware
 * 
 * Todos los middleware deben implementar esta interfaz
 */
interface MiddlewareInterface
{
    /**
     * Maneja la solicitud
     * 
     * @param array $params Parámetros de la ruta
     * @param Closure $next Siguiente middleware o controlador
     * @return mixed
     */
    public function handle(array $params, Closure $next);
}

/**
 * Ejemplo de un middleware de autenticación
 */
class AuthMiddleware implements MiddlewareInterface
{
    /**
     * Verifica si el usuario está autenticado
     * 
     * @param array $params Parámetros de la ruta
     * @param Closure $next Siguiente middleware o controlador
     * @return mixed
     */
    public function handle(array $params, Closure $next)
    {
        // Verificar token de autenticación
        $token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        
        if (empty($token)) {
            http_response_code(401);
            return [
                'error' => true,
                'message' => 'Autenticación requerida',
                'status' => 401
            ];
        }
        
        // Validar token (implementación simplificada)
        if (!$this->validateToken($token)) {
            http_response_code(401);
            return [
                'error' => true,
                'message' => 'Token inválido o expirado',
                'status' => 401
            ];
        }
        
        // Continuar con el siguiente middleware o controlador
        return $next();
    }
    
    /**
     * Valida un token de autenticación
     * 
     * @param string $token Token a validar
     * @return bool Resultado de la validación
     */
    protected function validateToken(string $token): bool
    {
        // Implementación real de validación de token
        // Esta es una versión simplificada para el ejemplo
        return true;
    }
}
?>
