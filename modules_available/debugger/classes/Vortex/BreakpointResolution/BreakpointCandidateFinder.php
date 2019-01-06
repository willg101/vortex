<?php

namespace Vortex\BreakpointResolution;

use PhpParser\Node;
use PhpParser\NodeVisitorAbstract;

use PhpParser\Node\Stmt\For_;
use PhpParser\Node\Expr\Array_;
use PhpParser\Node\Expr\ArrayItem;
use PhpParser\Node\Stmt\If_;
use PhpParser\Node\Stmt\Foreach_;
use PhpParser\Node\Stmt\Return_;
use PhpParser\Node\Stmt\While_;
use PhpParser\Node\Stmt\Break_;
use PhpParser\Node\Expr\Assign;
use PhpParser\Node\Expr\AssignOp;
use PhpParser\Node\Expr\PostInc;
use PhpParser\Node\Expr\PreInc;
use PhpParser\Node\Expr\PostDec;
use PhpParser\Node\Expr\PreDec;
use PhpParser\Node\Stmt\Function_;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\Include_;
use PhpParser\Node\Stmt\Expression;

class BreakpointCandidateFinder extends NodeVisitorAbstract {
    const WHITELISTED_NODE_ATTR = 'breakpoint_whitelisted';

    private $lines = [];
    private $end_line_sources = [];
    private $ancestors = [];

    public function enterNode(Node $node) {
        // Update parent/ancestor nodes
        $parent = null;
        if (!empty($this->ancestors)) {
            $parent = $this->ancestors[count($this->ancestors) - 1];
            $node->setAttribute('parent', $parent);
        }
        $this->ancestors[] = $node;

        // Child nodes of a 'stmts' property are candidates for breakpoints
        if (!empty($node->stmts)) {
            $this->whitelistNode($node->stmts);
        }

        // Only whitelisted nodes and nodes without parents are breakpoint candidates
        if (!($this->nodeIsWhitelisted($node) || !$parent)) {
            return;
        }

        if ($node instanceof Expression && $node->expr) {
            // Expressions themselves are not breakpoint candidates, but their children are
            $this->whitelistNode($node->expr);
        } elseif ($node instanceof For_) {
            // A for loops' FIRST init and cond expressions are breakpoint candidates, but not the
            // incrementor expression
            if ($node->init) {
                $this->lines[$node->init[0]->getEndLine()] = true;
            }
            if ($node->cond) {
                $this->lines[$node->cond[0]->getEndLine()] = true;
            }
        } elseif ($node instanceof Foreach_) {
            // A foreach loop breaks on the "as" keyword. We can only determine where "as" is when
            // the expression to iterate over is on the same line as the (first) loop variable
            $variable_start = $node->keyVar
                ? $node->keyVar->getStartLine()
                : $node->valueVar->getStartLine();
            if ($node->expr->getEndLine() == $variable_start) {
                $this->lines[$variable_start] = true;
            }
        } elseif ($node instanceof While_) {
            // A while loop breaks on the closing paren of the condition. We don't have access to
            // the location of the closing paren, so the best we can do is assume it's immediately
            // following the end of the cond expression.
            if ($node->cond) {
                $this->lines[$node->cond->getEndLine()] = true;
            }
        } elseif ($node instanceof If_) {
            // An if statement breaks on the opening brace. We don't have access to this location,
            // but we can assume with reasonable accuracy that it's on the line immediately before
            // the first statement of the body.
            if ($node->stmts) {
                $this->lines[$node->stmts[0]->getStartLine() - 1] = true;
            }
        } elseif ($node instanceof Function_
               || $node instanceof FuncCall
               || $node instanceof StaticCall
               || $node instanceof MethodCall) {
            // Function declarations and calls always break on the line that the function name (not,
            // when applicable, the class name (static calls) or object reference (method calls))
            // is located on.
            if ($node->name) {
                $this->lines[$node->name->getStartLine()] = true;
            }
        } elseif ($node instanceof Assign
               || $node instanceof AssignOp
               || $node instanceof PostInc
               || $node instanceof PostDec
               || $node instanceof PreInc
               || $node instanceof PreDec
               || $node instanceof Include_) {
            // Many statements break on their parent's last line when the parent is an instance of
            // PhpParser\Node\Stmt\Expression, and otherwise break on their own last line
            $parent = $node->getAttribute('parent');
            if ($parent && get_class($parent) == Expression::class) {
                $this->lines[$parent->getEndLine()] = true;
            } else {
                $this->lines[$node->getEndLine()] = true;
            }
        } elseif ($node instanceof Return_
               || $node instanceof Break_) {
            // Control statements break on their last line
            $this->lines[$node->getEndLine()] = true;
        }
    }

    protected function nodeIsWhitelisted($node) {
        return !! $node->getAttribute(static::WHITELISTED_NODE_ATTR);
    }

    protected function whitelistNode($nodes) {
        if (!is_array($nodes)) {
            $nodes = [ $nodes ];
        }

        foreach ($nodes as $node) {
            $node->setAttribute(static::WHITELISTED_NODE_ATTR, true);
        }
    }

    public function leaveNode(Node $node) {
        array_pop($this->ancestors);
    }

    public function getLines()
    {
        return array_keys($this->lines);
    }

    public function clear() {
        $this->ancestors = [];
        $this->lines = [];
        $this->end_line_sources = [];
    }
}


