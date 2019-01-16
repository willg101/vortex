<div class="scroller">
    <p class="auditor-record">
        This window lists all hooks that have been called since the last time this page was loaded.
        For each hook, a short description of the array passed to the hook is shown, as well as a
        stack trace indicating where the hook was fired from.
    </p>
    <?php foreach (hook_auditor_list_all_records() as $record): ?>
        <div class="auditor-record">
            <h2>hook_<?php echo $record['hook_name'] ?></h2>
            <h3>Items in the hook's data array:</h3>
            <?php if ($record['hook_data']) :?>
                <table>
                    <tr>
                        <td>key</td>
                        <td>type</td>
                    </tr>
                    <?php $_GET[0] = $record ?>
                    <?php foreach ($record['hook_data'] as $key => $type ): ?>
                        <tr>
                            <td><?php echo $key ?></td>
                            <td><?php echo $type ?></td>
                        </tr>
                    <?php endforeach ?>
                </table>
            <?php else: ?>
                <i>Empty array</i><br>
            <?php endif ?>
            <h3>Stack trace:</h3>
            <table>
                <tr>
                    <td>function</td>
                    <td>line</td>
                    <td>file</td>
                </tr>
                <?php foreach ($record['trace'] as $frame ): ?>
                    <tr>
                        <td><?php echo $frame['function'] ?>()</td>
                        <td><?php echo $frame['line'] ?></td>
                        <td><?php echo $frame['file'] ?></td>
                    </tr>
                <?php endforeach ?>
            </table>
        </div>
    <?php endforeach ?> 
</div>
